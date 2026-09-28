package ru.khudob1n.krasnodar.transport.ui.journey

import ru.khudob1n.krasnodar.transport.data.Catalog
import ru.khudob1n.krasnodar.transport.data.LatLngPoint
import ru.khudob1n.krasnodar.transport.data.WalkRoute
import ru.khudob1n.krasnodar.transport.domain.Leg
import ru.khudob1n.krasnodar.transport.domain.PlannedJourney
import ru.khudob1n.krasnodar.transport.domain.PlannedLeg
import ru.khudob1n.krasnodar.transport.domain.distanceMeters
import ru.khudob1n.krasnodar.transport.map.JourneyLines
import ru.khudob1n.krasnodar.transport.map.JourneySegment
import ru.khudob1n.krasnodar.transport.ui.components.TransportType

/** Ключ пешего отрезка для кэша путей по улицам. */
fun walkKey(a: LatLngPoint, b: LatLngPoint) = "${a.lat},${a.lng};${b.lat},${b.lng}"

private fun nearestIndex(points: List<LatLngPoint>, target: LatLngPoint, from: Int): Int {
    var best = from
    var bestDistance = Double.POSITIVE_INFINITY
    for (i in from until points.size) {
        val d = distanceMeters(points[i].lat, points[i].lng, target.lat, target.lng)
        if (d < bestDistance) { bestDistance = d; best = i }
    }
    return best
}

/**
 * Линии варианта на карте (MapJourneyLayer сайта): поездка - кусок линии направления между
 * остановкой посадки и выхода, цветом вида транспорта; пешком - путь по улицам из OSRM,
 * пока его нет - прямая.
 */
fun journeyLines(
    journey: PlannedJourney,
    catalog: Catalog?,
    pointOf: (Long) -> LatLngPoint?,
    walkRoutes: Map<String, WalkRoute?>,
    colorOf: (TransportType) -> Int,
    walkColor: Int,
): JourneyLines {
    val segments = journey.legs.mapNotNull { step ->
        val a = pointOf(step.leg.from) ?: return@mapNotNull null
        val b = pointOf(step.leg.to) ?: return@mapNotNull null
        when (step) {
            is PlannedLeg.WalkStep -> JourneySegment(walkRoutes[walkKey(a, b)]?.points ?: listOf(a, b), walkColor, walk = true)
            is PlannedLeg.RideStep -> {
                val line = catalog?.geometryBySubroute?.get(step.chosen.subrouteId)?.points
                val points = if (line == null || line.size < 2) listOf(a, b) else {
                    val start = nearestIndex(line, a, 0)
                    val end = nearestIndex(line, b, start)
                    listOf(a) + line.subList(start, end + 1) + b
                }
                JourneySegment(points, colorOf(step.chosen.type), walk = false)
            }
        }
    }
    val first = journey.legs.firstOrNull()?.leg?.from?.let(pointOf)
    val last = journey.legs.lastOrNull()?.leg?.to?.let(pointOf)
    return JourneyLines(segments, first, last)
}

/** Пешие отрезки варианта - для загрузки путей по улицам. */
fun walkPairs(journey: PlannedJourney, pointOf: (Long) -> LatLngPoint?) = journey.legs.mapNotNull { step ->
    val leg = step.leg as? Leg.WalkLeg ?: return@mapNotNull null
    val a = pointOf(leg.from) ?: return@mapNotNull null
    val b = pointOf(leg.to) ?: return@mapNotNull null
    a to b
}
