package ru.khudob1n.krasnodar.shared

import kotlinx.serialization.Serializable

@Serializable
data class LatLngPoint(val lat: Double, val lng: Double)

/** Машина из /api/app/live/vehicles (поля - как в приложении для Android). */
@Serializable
data class Vehicle(
    val deviceCode: String,
    val routeId: Long,
    val subrouteId: Long,
    val routeType: String,
    val routeNumber: String,
    val lat: Double,
    val lng: Double,
    val dir: Double = 0.0,
    val navTime: String? = null,
    val lowFloor: Boolean = false,
)

enum class TransportType { Bus, Troll, Tram }

/** Тип по коду фида: "А" автобус, "Тб" троллейбус, "Тм" трамвай. */
val Vehicle.transport: TransportType?
    get() = when (routeType) {
        "А" -> TransportType.Bus
        "Тб" -> TransportType.Troll
        "Тм" -> TransportType.Tram
        else -> null
    }

@Serializable
data class RouteGeometry(val subrouteId: Long, val points: List<LatLngPoint>)
