package ru.khudob1n.krasnodar.transport.map

import ru.khudob1n.krasnodar.transport.data.LatLngPoint

/** Центр и рамка карты - как на сайте (passenger/client/common/constants/coords.ts). */
object City {
    val center = LatLngPoint(45.0355, 38.9753)
    const val DEFAULT_ZOOM = 13.0

    const val NORTH = 45.35
    const val EAST = 39.45
    const val SOUTH = 44.85
    const val WEST = 38.6
}
