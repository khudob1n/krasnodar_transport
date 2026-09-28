package ru.khudob1n.krasnodar.transport.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import ru.khudob1n.krasnodar.transport.ui.components.TransportType

// Модели - один в один с записями API (docs/app-api.md); незнакомые поля игнорируются (см. Api.json).

@Serializable
data class LatLngPoint(val lat: Double, val lng: Double)

/** Пеший путь по улицам из OSRM: длина и линия. */
data class WalkRoute(val meters: Double, val points: List<LatLngPoint>)

@Serializable
data class Route(
    val id: Long,
    val type: String,
    val number: String,
    val shortName: String,
    val name: String,
    val fromStation: String,
    val toStation: String,
    val companyName: String = "",
) {
    val transport: TransportType? get() = transportOfRu(type)
}

@Serializable
data class Station(val id: Long, val name: String, val lat: Double, val lng: Double)

@Serializable
data class Direction(
    val subrouteId: Long,
    val directionTo: String,
    val forward: Boolean,
    val stopsCount: Int,
    val stations: List<Station>,
)

@Serializable
data class RouteStops(
    val id: Long,
    val type: String,
    val number: String,
    val shortName: String,
    val name: String,
    val fromStation: String,
    val toStation: String,
    val directions: List<Direction>,
) {
    val transport: TransportType? get() = transportOfRu(type)
}

@Serializable
data class RouteGeometry(
    val routeId: Long,
    val subrouteId: Long,
    val directionName: String = "",
    val forward: Boolean = true,
    val approximate: Boolean = false,
    val points: List<LatLngPoint>,
)

@Serializable
data class Stop(val id: Long, val name: String, val lat: Double, val lng: Double)

@Serializable
data class ScheduleTrip(
    @SerialName("stop_id") val stopId: Long,
    @SerialName("route_number") val routeNumber: String,
    @SerialName("route_type") val routeType: String,
    @SerialName("day_type") val dayType: String,
    val time: String,
    @SerialName("to_station") val toStation: String,
)

@Serializable
data class Depot(val id: String, val name: String, val type: String, val polygons: List<List<List<Double>>>)

@Serializable
data class RailStation(
    val id: String,
    val name: String,
    val kind: String,
    val description: String = "",
    val lat: Double,
    val lng: Double,
)

@Serializable
data class HomeCard(
    val id: Int,
    val type: String,
    val title: String,
    val url: String,
    val size: String? = null,
    val footerCaption: String? = null,
    val dynamicId: String? = null,
)

@Serializable
data class Article(val slug: String, val title: String, val order: Int = 0, val body: String)

@Serializable
data class Vehicle(
    val deviceCode: String,
    val gosNum: String = "",
    val routeId: Long,
    val subrouteId: Long,
    val routeType: String,
    val routeNumber: String,
    val lat: Double,
    val lng: Double,
    val speed: Double? = null,
    val dir: Double = 0.0,
    val navTime: String? = null,
    val lowFloor: Boolean = false,
    val model: String = "",
    val operator: String = "",
    val boardNumber: String = "",
    val from: String = "",
    val to: String = "",
) {
    /** Тип по коду фида: "А" автобус, "Тб" троллейбус, "Тм" трамвай. */
    val transport: TransportType?
        get() = when (routeType) {
            "А" -> TransportType.Bus
            "Тб" -> TransportType.Troll
            "Тм" -> TransportType.Tram
            else -> null
        }
}

@Serializable
data class RailDeparture(
    val number: String = "",
    val title: String = "",
    val transportType: String = "",
    val carrier: String = "",
    val carrierCode: String = "",
    val departure: String? = null,
    val arrival: String? = null,
    val platform: String = "",
    val terminal: String = "",
)

@Serializable
data class RailSchedule(val date: String = "", val departures: List<RailDeparture> = emptyList())

@Serializable
data class Traffic(val level: Int, val color: String? = null, val hint: String? = null, val trend: Int = 0, val url: String? = null)

@Serializable
data class Place(val title: String, val subtitle: String = "", val lat: Double, val lng: Double)

fun transportOfRu(type: String): TransportType? = when (type) {
    "Автобус" -> TransportType.Bus
    "Троллейбус" -> TransportType.Troll
    "Трамвай" -> TransportType.Tram
    else -> null
}

/** Коллекции API (docs/app-api.md). */
object Collections {
    const val ROUTES = "ground_transport/routes"
    const val ROUTE_STOPS = "ground_transport/route_stops"
    const val ROUTE_GEOMETRY = "ground_transport/route_geometry"
    const val STOPS = "ground_transport/stops"
    const val SCHEDULE_TRIPS = "ground_transport/schedule_trips"
    const val DEPOTS = "ground_transport/depots"
    const val RAIL_STATIONS = "rail/stations"
    const val HOME_CARDS = "site/home_cards"
    const val ARTICLES = "site/faq_articles"
}
