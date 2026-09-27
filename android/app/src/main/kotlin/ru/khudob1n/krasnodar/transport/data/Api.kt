package ru.khudob1n.krasnodar.transport.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

class NotFoundException(path: String) : IOException("$path -> HTTP 404")

/** Клиент API сайта (docs/app-api.md). Все запросы - GET к одному базовому адресу. */
class Api(baseUrl: String, private val client: OkHttpClient = defaultClient()) {
    private val base: HttpUrl = baseUrl.trimEnd('/').toHttpUrl()

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
        get(url("api/app/collections"), CollectionsResponse.serializer()).collections

    /** Все записи коллекции - по страницам по 500, пока не наберётся total. */
    suspend fun <T> records(collection: String, serializer: KSerializer<T>, filters: String? = null): List<T> {
        val all = ArrayList<T>()
        var page = 1
        while (true) {
            val url = url("api/app/collections/$collection/records").newBuilder()
                .addQueryParameter("page", page.toString())
                .addQueryParameter("pageSize", "500")
                .apply { if (filters != null) addQueryParameter("filters", filters) }
                .build()
            val res = get(url, RecordsResponse.serializer())
            if (res.records.isEmpty()) break
            res.records.mapTo(all) { json.decodeFromJsonElement(serializer, it.data) }
            if (all.size >= res.total) break
            page += 1
        }
        return all
    }

    suspend fun vehicles(): List<Vehicle> = get(url("api/app/live/vehicles"), VehiclesResponse.serializer()).vehicles

    suspend fun traffic(): Traffic = get(url("api/app/live/traffic"), Traffic.serializer())

    /** Табло вокзала / аэропорта (Яндекс Расписания через сервер). 404 - станции нет в расписаниях. */
    suspend fun railSchedule(lat: Double, lng: Double, date: String, transport: String, event: String, name: String): RailSchedule {
        val url = url("api/app/live/rail/schedule").newBuilder()
            .addQueryParameter("lat", lat.toString()).addQueryParameter("lng", lng.toString())
            .addQueryParameter("date", date).addQueryParameter("transport", transport)
            .addQueryParameter("event", event).addQueryParameter("name", name)
            .build()
        return get(url, RailSchedule.serializer())
    }

    suspend fun geocode(query: String): List<Place> =
        get(url("api/geocode").newBuilder().addQueryParameter("q", query).build(), PlacesResponse.serializer()).places

    @Serializable
    private data class ReversePlace(val title: String)

    @Serializable
    private data class ReverseResponse(val place: ReversePlace? = null)

    /** Подпись для точки на карте: ближайший адрес или объект (только название); null - ничего рядом. */
    suspend fun reverseGeocode(lat: Double, lng: Double): String? = get(
        url("api/geocode/reverse").newBuilder()
            .addQueryParameter("lat", "%.6f".format(java.util.Locale.US, lat))
            .addQueryParameter("lng", "%.6f".format(java.util.Locale.US, lng)).build(),
        ReverseResponse.serializer(),
    ).place?.title

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
        val res = get(url("api/walk/route/v1/foot/${osrmCoords(listOf(from, to))}").newBuilder()
            .addQueryParameter("overview", "full").addQueryParameter("geometries", "geojson").build(), OsrmRouteResponse.serializer(), walkClient)
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
        val res = get(url("api/walk/table/v1/foot/${osrmCoords(listOf(point) + targets)}").newBuilder()
            .addQueryParameter(if (reverse) "sources" else "destinations", others)
            .addQueryParameter(if (reverse) "destinations" else "sources", "0")
            .addQueryParameter("annotations", "distance").build(), OsrmTableResponse.serializer(), walkClient)
        if (res.code != "Ok") throw IOException("OSRM table: ${res.code}")
        return if (reverse) res.distances.map { it.firstOrNull() } else res.distances.first()
    }

    private fun osrmCoords(points: List<LatLngPoint>) =
        points.joinToString(";") { "%.6f,%.6f".format(java.util.Locale.US, it.lng, it.lat) }

    // OSRM не ответил за 4 с - считаем по прямой, поиск маршрута не ждёт (как у сайта).
    private val walkClient = client.newBuilder().callTimeout(4, TimeUnit.SECONDS).build()

    /** Отчёт о сбое (CrashReporter). */
    suspend fun sendCrashReport(report: CrashReport) = withContext(Dispatchers.IO) {
        val body = json.encodeToString(CrashReport.serializer(), report)
            .toRequestBody("application/json".toMediaType())
        client.newCall(Request.Builder().url(url("api/app/crash-reports")).post(body).build()).execute().use { response ->
            if (!response.isSuccessful) throw IOException("crash-reports -> HTTP ${response.code}")
        }
    }

    private fun url(path: String): HttpUrl = base.newBuilder().addPathSegments(path).build()

    private suspend fun <T> get(url: HttpUrl, serializer: KSerializer<T>, client: OkHttpClient = this.client): T = withContext(Dispatchers.IO) {
        client.newCall(Request.Builder().url(url).build()).execute().use { response ->
            if (response.code == 404) throw NotFoundException(url.encodedPath)
            if (!response.isSuccessful) throw IOException("${url.encodedPath} -> HTTP ${response.code}")
            json.decodeFromString(serializer, response.body.string())
        }
    }

    companion object {
        /** Незнакомые поля не ломают разбор - API добавляет поля без смены версии. */
        val json = Json { ignoreUnknownKeys = true; coerceInputValues = true; explicitNulls = false }

        fun defaultClient(): OkHttpClient = OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()

        fun <T> listOf(serializer: KSerializer<T>) = ListSerializer(serializer)
    }
}
