package ru.khudob1n.krasnodar.transport.data

import io.ktor.client.HttpClient
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.timeout
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import kotlinx.io.IOException
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import ru.khudob1n.krasnodar.transport.platform.fixed

class NotFoundException(path: String) : IOException("$path -> HTTP 404")

/** Клиент API сайта (docs/app-api.md). Все запросы - GET к одному базовому адресу. */
class Api(baseUrl: String, private val client: HttpClient = defaultClient()) {
    private val base: String = baseUrl.trimEnd('/')

    @Serializable
    data class CollectionInfo(val key: String, val count: Int = 0, val updatedAt: String? = null)

    @Serializable
    private data class CollectionsResponse(val collections: List<CollectionInfo>)

    @Serializable
    private data class RecordsResponse(val total: Int, val records: List<RecordEnvelope>)

    @Serializable
    private data class RecordEnvelope(val data: JsonElement)

    @Serializable
    private data class VehiclesResponse(val vehicles: List<Vehicle>)

    @Serializable
    private data class PlacesResponse(val places: List<Place> = emptyList())

    suspend fun collections(): List<CollectionInfo> =
        get("api/app/collections", CollectionsResponse.serializer()).collections

    /** Все записи коллекции - по страницам по 500, пока не наберётся total. */
    suspend fun <T> records(collection: String, serializer: KSerializer<T>, filters: String? = null): List<T> {
        val all = ArrayList<T>()
        var page = 1
        while (true) {
            val res = get("api/app/collections/$collection/records", RecordsResponse.serializer()) {
                parameter("page", page)
                parameter("pageSize", 500)
                if (filters != null) parameter("filters", filters)
            }
            if (res.records.isEmpty()) break
            res.records.mapTo(all) { json.decodeFromJsonElement(serializer, it.data) }
            if (all.size >= res.total) break
            page += 1
        }
        return all
    }

    suspend fun vehicles(): List<Vehicle> = get("api/app/live/vehicles", VehiclesResponse.serializer()).vehicles

    suspend fun traffic(): Traffic = get("api/app/live/traffic", Traffic.serializer())

    /** Табло вокзала / аэропорта (Яндекс Расписания через сервер). 404 - станции нет в расписаниях. */
    suspend fun railSchedule(lat: Double, lng: Double, date: String, transport: String, event: String, name: String): RailSchedule {
        return get("api/app/live/rail/schedule", RailSchedule.serializer()) {
            parameter("lat", lat); parameter("lng", lng); parameter("date", date)
            parameter("transport", transport); parameter("event", event); parameter("name", name)
        }
    }

    suspend fun geocode(query: String): List<Place> =
        get("api/geocode", PlacesResponse.serializer()) { parameter("q", query) }.places

    @Serializable
    private data class ReversePlace(val title: String)

    @Serializable
    private data class ReverseResponse(val place: ReversePlace? = null)

    /** Подпись для точки на карте: ближайший адрес или объект (только название); null - ничего рядом. */
    suspend fun reverseGeocode(lat: Double, lng: Double): String? =
        get("api/geocode/reverse", ReverseResponse.serializer()) { parameter("lat", lat.fixed(6)); parameter("lng", lng.fixed(6)) }.place?.title

    @Serializable
    private data class OsrmGeometry(val coordinates: List<List<Double>>)

    @Serializable
    private data class OsrmRoute(val distance: Double, val geometry: OsrmGeometry)

    @Serializable
    private data class OsrmRouteResponse(val code: String = "", val routes: List<OsrmRoute> = emptyList())

    @Serializable
    private data class OsrmTableResponse(val code: String = "", val distances: List<List<Double?>> = emptyList())

    /** Пеший путь по улицам (OSRM foot): метры и линия [lat, lng]; null - пути нет. */
    suspend fun walkRoute(from: LatLngPoint, to: LatLngPoint): WalkRoute? {
        val res = get("api/walk/route/v1/foot/${osrmCoords(listOf(from, to))}", OsrmRouteResponse.serializer()) {
            parameter("overview", "full"); parameter("geometries", "geojson"); walkTimeout()
        }
        val route = res.routes.firstOrNull() ?: return null
        return WalkRoute(route.distance, route.geometry.coordinates.map { LatLngPoint(it[1], it[0]) })
    }

    /**
     * Пешие расстояния от одной точки до многих (reverse - от многих до одной) одним запросом.
     * В списке null - до этой точки пути нет.
     */
    suspend fun walkDistances(point: LatLngPoint, targets: List<LatLngPoint>, reverse: Boolean): List<Double?> {
        if (targets.isEmpty()) return emptyList()
        val others = targets.indices.joinToString(";") { (it + 1).toString() }
        val res = get("api/walk/table/v1/foot/${osrmCoords(listOf(point) + targets)}", OsrmTableResponse.serializer()) {
            parameter(if (reverse) "sources" else "destinations", others)
            parameter(if (reverse) "destinations" else "sources", "0")
            parameter("annotations", "distance")
            walkTimeout()
        }
        if (res.code != "Ok") throw IOException("OSRM table: ${res.code}")
        return if (reverse) res.distances.map { it.firstOrNull() } else res.distances.first()
    }

    private fun osrmCoords(points: List<LatLngPoint>) =
        points.joinToString(";") { "${it.lng.fixed(6)},${it.lat.fixed(6)}" }

    // OSRM не ответил за 4 с - считаем по прямой, поиск маршрута не ждёт (как у сайта).
    private fun HttpRequestBuilder.walkTimeout() = timeout { requestTimeoutMillis = 4_000 }

    /** Отчёт о сбое (CrashReporter). */
    suspend fun sendCrashReport(report: CrashReport) {
        val response = client.post("$base/api/app/crash-reports") {
            contentType(ContentType.Application.Json)
            setBody(json.encodeToString(CrashReport.serializer(), report))
        }
        if (!response.status.isSuccess()) throw IOException("crash-reports -> HTTP ${response.status.value}")
    }

    private suspend fun <T> get(path: String, serializer: KSerializer<T>, block: HttpRequestBuilder.() -> Unit = {}): T {
        val response = client.get("$base/$path", block)
        if (response.status.value == 404) throw NotFoundException(path)
        if (!response.status.isSuccess()) throw IOException("$path -> HTTP ${response.status.value}")
        return json.decodeFromString(serializer, response.bodyAsText())
    }

    companion object {
        /** Незнакомые поля не ломают разбор - API добавляет поля без смены версии. */
        val json = Json { ignoreUnknownKeys = true; coerceInputValues = true; explicitNulls = false }

        fun defaultClient(): HttpClient = HttpClient {
            install(HttpTimeout) {
                connectTimeoutMillis = 10_000
                socketTimeoutMillis = 30_000
            }
        }

        fun <T> listOf(serializer: KSerializer<T>) = ListSerializer(serializer)
    }
}
