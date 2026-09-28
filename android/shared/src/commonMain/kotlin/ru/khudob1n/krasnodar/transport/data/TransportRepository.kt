package ru.khudob1n.krasnodar.transport.data

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.IO
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import ru.khudob1n.krasnodar.transport.platform.Files
import ru.khudob1n.krasnodar.transport.platform.Platform

/**
 * Данные приложения с кэшем на устройстве (TASK-265). Справочник открывается сразу из копии на
 * диске, а в фоне сверяется с версиями коллекций на сервере (count + updatedAt, docs/app-api.md) -
 * перекачиваются только изменившиеся. Расписания - по остановке, тоже с кэшем до смены версии.
 */
class TransportRepository(private val api: Api) {
    private val versionsFile = Files.path("catalog", "versions.json")
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val lock = Mutex()

    private val _catalog = MutableStateFlow<Catalog?>(null)
    val catalog: StateFlow<Catalog?> = _catalog.asStateFlow()

    private var versions: MutableMap<String, String> = readVersions()
    private val schedules = HashMap<Long, List<ScheduleTrip>>()

    /** Показать кэш (если есть) и обновить справочник с сервера. Вызывать при запуске. */
    fun start() {
        scope.launch {
            runCatching { lock.withLock { readCatalogFromDisk() } }.getOrNull()?.let { _catalog.value = it }
            refresh()
        }
    }

    /** Сверить версии и перекачать изменившиеся коллекции. Ошибки сети - не страшно, живём на кэше. */
    suspend fun refresh() {
        try {
            val remote = api.collections().associate { it.key to "${it.count}|${it.updatedAt}" }
            lock.withLock {
                val stale = CATALOG_COLLECTIONS.filter { key -> remote[key] != versions[key] || !Files.exists(file(key)) }
                coroutineScope {
                    stale.map { key -> async { key to download(key) } }.forEach { job ->
                        val (key, text) = job.await()
                        Files.writeText(file(key), text)
                        versions[key] = remote[key] ?: ""
                    }
                }
                // Расписания: версия сменилась - кэш по остановкам больше не верен.
                val scheduleVersion = remote[Collections.SCHEDULE_TRIPS]
                if (scheduleVersion != versions[Collections.SCHEDULE_TRIPS]) {
                    scheduleLock.withLock { schedules.clear() }
                    Files.delete(Files.path("catalog", "schedules"))
                    versions[Collections.SCHEDULE_TRIPS] = scheduleVersion ?: ""
                }
                writeVersions()
                if (stale.isNotEmpty() || _catalog.value == null) _catalog.value = readCatalogFromDisk()
            }
        } catch (error: Exception) {
            if (error is kotlinx.coroutines.CancellationException) throw error
            Platform.log(TAG, "Справочник не обновился, работаем на кэше", error)
        }
    }

    /** Расписание остановки (все маршруты, будни и выходные). */
    suspend fun schedule(stopId: Long): List<ScheduleTrip> {
        scheduleLock.withLock { schedules[stopId] }?.let { return it }
        // Одну остановку просят сразу несколько вариантов маршрута - качаем один раз.
        val job = scheduleLock.withLock { loading.getOrPut(stopId) { scope.async { loadSchedule(stopId) } } }
        return try { job.await() } finally { scheduleLock.withLock { if (loading[stopId] === job) loading.remove(stopId) } }
    }

    private val scheduleLock = Mutex()
    private val loading = HashMap<Long, Deferred<List<ScheduleTrip>>>()

    private suspend fun loadSchedule(stopId: Long): List<ScheduleTrip> = withContext(Dispatchers.IO) {
        val cached = Files.path("catalog", "schedules", "$stopId.json")
        val trips = if (Files.exists(cached)) {
            Api.json.decodeFromString(TRIPS, Files.readText(cached))
        } else {
            api.records(Collections.SCHEDULE_TRIPS, ScheduleTrip.serializer(), filters = """{"stop_id":$stopId}""").also {
                Files.writeText(cached, Api.json.encodeToString(TRIPS, it))
            }
        }
        scheduleLock.withLock { schedules[stopId] = trips }
        trips
    }

    suspend fun vehicles(): List<Vehicle> = api.vehicles()

    suspend fun traffic(): Traffic = api.traffic()

    suspend fun railSchedule(station: RailStation, date: String, event: String): RailSchedule {
        val transport = when (station.kind) { "bus_terminal" -> "bus"; "airport" -> "plane"; else -> "rail" }
        return api.railSchedule(station.lat, station.lng, date, transport, event, station.name)
    }

    suspend fun geocode(query: String): List<Place> = api.geocode(query)

    suspend fun reverseGeocode(point: LatLngPoint): String? = api.reverseGeocode(point.lat, point.lng)

    /** Пешие маршруты (OSRM) для поиска «от двери до двери»; ошибки - null, считаем по прямой. */
    val walk = object : ru.khudob1n.krasnodar.transport.domain.WalkService {
        override suspend fun distances(point: LatLngPoint, targets: List<LatLngPoint>, reverse: Boolean) =
            runCatching { api.walkDistances(point, targets, reverse) }.getOrNull()

        override suspend fun route(from: LatLngPoint, to: LatLngPoint) = runCatching { api.walkRoute(from, to) }.getOrNull()
    }

    suspend fun homeCards(): List<HomeCard> = api.records(Collections.HOME_CARDS, HomeCard.serializer()).sortedBy { it.id }

    suspend fun articles(): List<Article> = api.records(Collections.ARTICLES, Article.serializer()).sortedBy { it.order }

    private suspend fun download(key: String): String {
        val serializer = serializerOf(key)
        @Suppress("UNCHECKED_CAST")
        val list = api.records(key, serializer as KSerializer<Any>)
        return Api.json.encodeToString(ListSerializer(serializer), list)
    }

    private fun readCatalogFromDisk(): Catalog? {
        if (CATALOG_COLLECTIONS.any { !Files.exists(file(it)) }) return null
        return Catalog(
            routes = read(Collections.ROUTES, Route.serializer()),
            routeStops = read(Collections.ROUTE_STOPS, RouteStops.serializer()),
            geometry = read(Collections.ROUTE_GEOMETRY, RouteGeometry.serializer()),
            stops = read(Collections.STOPS, Stop.serializer()),
            depots = read(Collections.DEPOTS, Depot.serializer()),
            railStations = read(Collections.RAIL_STATIONS, RailStation.serializer()),
        )
    }

    private fun <T> read(key: String, serializer: KSerializer<T>): List<T> =
        Api.json.decodeFromString(ListSerializer(serializer), Files.readText(file(key)))

    private fun file(key: String) = Files.path("catalog", key.replace('/', '_') + ".json")

    private fun readVersions(): MutableMap<String, String> =
        runCatching { Api.json.decodeFromString(VERSIONS, Files.readText(versionsFile)).toMutableMap() }.getOrElse { mutableMapOf() }

    private fun writeVersions() = Files.writeText(versionsFile, Api.json.encodeToString(VERSIONS, versions))

    private companion object {
        const val TAG = "TransportRepository"
        val TRIPS = ListSerializer(ScheduleTrip.serializer())
        val VERSIONS = MapSerializer(String.serializer(), String.serializer())
        val CATALOG_COLLECTIONS = listOf(
            Collections.ROUTES, Collections.ROUTE_STOPS, Collections.ROUTE_GEOMETRY,
            Collections.STOPS, Collections.DEPOTS, Collections.RAIL_STATIONS,
        )

        fun serializerOf(key: String): KSerializer<*> = when (key) {
            Collections.ROUTES -> Route.serializer()
            Collections.ROUTE_STOPS -> RouteStops.serializer()
            Collections.ROUTE_GEOMETRY -> RouteGeometry.serializer()
            Collections.STOPS -> Stop.serializer()
            Collections.DEPOTS -> Depot.serializer()
            Collections.RAIL_STATIONS -> RailStation.serializer()
            else -> error("Нет сериализатора для $key")
        }
    }
}
