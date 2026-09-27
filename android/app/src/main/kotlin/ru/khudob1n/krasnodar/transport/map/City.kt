package ru.khudob1n.krasnodar.transport.map

import org.maplibre.android.geometry.LatLng
import org.maplibre.android.geometry.LatLngBounds

/** Центр и рамка карты - как на сайте (passenger/client/common/constants/coords.ts). */
object City {
    val center = LatLng(45.0355, 38.9753)
    const val DEFAULT_ZOOM = 13.0

    val bounds: LatLngBounds = LatLngBounds.from(45.35, 39.45, 44.85, 38.6)
}
