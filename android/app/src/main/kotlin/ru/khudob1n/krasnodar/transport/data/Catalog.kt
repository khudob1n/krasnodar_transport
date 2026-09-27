package ru.khudob1n.krasnodar.transport.data

/** Справочник для карты: всё, кроме расписаний (они - по остановке, см. TransportRepository.schedule). */
data class Catalog(
    val routes: List<Route>,
    val routeStops: List<RouteStops>,
    val geometry: List<RouteGeometry>,
    val stops: List<Stop>,
    val depots: List<Depot>,
    val railStations: List<RailStation>,
) {
    val routesById: Map<Long, Route> = routes.associateBy { it.id }
    val routeStopsById: Map<Long, RouteStops> = routeStops.associateBy { it.id }
    val stopsById: Map<Long, Stop> = stops.associateBy { it.id }
    val geometryBySubroute: Map<Long, RouteGeometry> = geometry.associateBy { it.subrouteId }

    /** Остановка -> виды транспорта, которые через неё ходят (loadStopTypes на сайте). */
    val stopTypes: Map<Long, Set<ru.khudob1n.krasnodar.transport.ui.components.TransportType>> by lazy {
        buildMap<Long, MutableSet<ru.khudob1n.krasnodar.transport.ui.components.TransportType>> {
            for (route in routeStops) {
                val type = route.transport ?: continue
                for (direction in route.directions) for (station in direction.stations) {
                    getOrPut(station.id) { mutableSetOf() }.add(type)
                }
            }
        }
    }
}
