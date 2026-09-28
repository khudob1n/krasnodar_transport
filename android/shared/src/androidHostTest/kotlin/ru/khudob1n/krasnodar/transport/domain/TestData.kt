package ru.khudob1n.krasnodar.transport.domain

import kotlinx.serialization.KSerializer
import kotlinx.serialization.builtins.ListSerializer
import ru.khudob1n.krasnodar.transport.data.Api
import ru.khudob1n.krasnodar.transport.data.Catalog
import ru.khudob1n.krasnodar.transport.data.Depot
import ru.khudob1n.krasnodar.transport.data.RailStation
import ru.khudob1n.krasnodar.transport.data.Route
import ru.khudob1n.krasnodar.transport.data.RouteGeometry
import ru.khudob1n.krasnodar.transport.data.RouteStops
import ru.khudob1n.krasnodar.transport.data.Stop
import java.io.File

/** Настоящие данные Краснодара из data/ - те же, что в админке и на сайте. */
object TestData {
    private val root = File("../../data")
    private fun <T> read(path: String, serializer: KSerializer<T>): List<T> =
        Api.json.decodeFromString(ListSerializer(serializer), File(root, path).readText())

    val catalog: Catalog by lazy {
        Catalog(
            routes = read("ground_transport/routes.json", Route.serializer()),
            routeStops = read("ground_transport/route_stops.json", RouteStops.serializer()),
            geometry = read("ground_transport/route_geometry.json", RouteGeometry.serializer()),
            stops = read("ground_transport/stops.json", Stop.serializer()),
            depots = read("ground_transport/depots.json", Depot.serializer()),
            railStations = read("rail/stations.json", RailStation.serializer()),
        )
    }
}
