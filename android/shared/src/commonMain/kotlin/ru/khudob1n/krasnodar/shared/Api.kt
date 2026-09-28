package ru.khudob1n.krasnodar.shared

import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.statement.bodyAsText
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement

const val SITE = "https://krasnodar-transport.khudob1n.ru"

/** API сайта (docs/app-api.md) - те же запросы, что у Android-приложения. */
class Api(private val client: HttpClient = HttpClient()) {
    private val json = Json { ignoreUnknownKeys = true }

    @Serializable
    private data class VehiclesResponse(val vehicles: List<Vehicle>)

    @Serializable
    private data class RecordsResponse(val total: Int, val records: List<RecordEnvelope>)

    @Serializable
    private data class RecordEnvelope(val data: JsonElement)

    /**
     * Стиль карты сайта. Глифы у сайта по относительному пути /fonts/... - нативному MapLibre
     * нужен полный адрес (на Android их же берут из assets).
     */
    suspend fun mapStyle(dark: Boolean): String =
        client.get("$SITE/map-style-${if (dark) "dark" else "light"}.json").bodyAsText()
            .replace("\"/fonts/{fontstack}/{range}.pbf\"", "\"$SITE/fonts/{fontstack}/{range}.pbf\"")

    suspend fun vehicles(): List<Vehicle> =
        json.decodeFromString(VehiclesResponse.serializer(), client.get("$SITE/api/app/live/vehicles").bodyAsText()).vehicles

    /** Линии направлений маршрутов - по страницам по 500. */
    suspend fun geometry(): List<RouteGeometry> {
        val all = ArrayList<RouteGeometry>()
        var page = 1
        while (true) {
            val text = client.get("$SITE/api/app/collections/ground_transport/route_geometry/records") {
                parameter("page", page)
                parameter("pageSize", 500)
            }.bodyAsText()
            val res = json.decodeFromString(RecordsResponse.serializer(), text)
            if (res.records.isEmpty()) break
            res.records.mapTo(all) { json.decodeFromJsonElement(RouteGeometry.serializer(), it.data) }
            if (all.size >= res.total) break
            page++
        }
        return all
    }
}
