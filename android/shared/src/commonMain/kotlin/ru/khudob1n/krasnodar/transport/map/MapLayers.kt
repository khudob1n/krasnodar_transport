package ru.khudob1n.krasnodar.transport.map

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.unit.DpOffset
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.maplibre.compose.expressions.dsl.asBoolean
import org.maplibre.compose.expressions.dsl.asNumber
import org.maplibre.compose.expressions.dsl.asString
import org.maplibre.compose.expressions.dsl.const
import org.maplibre.compose.expressions.dsl.convertToColor
import org.maplibre.compose.expressions.dsl.eq
import org.maplibre.compose.expressions.dsl.feature
import org.maplibre.compose.expressions.dsl.case
import org.maplibre.compose.expressions.dsl.image
import org.maplibre.compose.expressions.dsl.switch
import org.maplibre.compose.expressions.value.LineCap
import org.maplibre.compose.expressions.value.LineJoin
import org.maplibre.compose.expressions.value.SymbolAnchor
import org.maplibre.compose.interaction.ClickResult
import org.maplibre.compose.layers.FillLayer
import org.maplibre.compose.layers.LineLayer
import org.maplibre.compose.layers.SymbolLayer
import org.maplibre.compose.sources.GeoJsonData
import org.maplibre.compose.sources.rememberGeoJsonSource
import org.maplibre.spatialk.geojson.Feature
import org.maplibre.spatialk.geojson.FeatureCollection
import org.maplibre.spatialk.geojson.Geometry
import org.maplibre.spatialk.geojson.LineString
import org.maplibre.spatialk.geojson.Point
import org.maplibre.spatialk.geojson.Polygon
import org.maplibre.spatialk.geojson.Position
import ru.khudob1n.krasnodar.transport.assets.WebAssets
import ru.khudob1n.krasnodar.transport.data.Catalog
import ru.khudob1n.krasnodar.transport.data.LatLngPoint
import ru.khudob1n.krasnodar.transport.data.Vehicle
import ru.khudob1n.krasnodar.transport.platform.AppConfig
import ru.khudob1n.krasnodar.transport.platform.hexRgb
import ru.khudob1n.krasnodar.transport.settings.Basemap
import ru.khudob1n.krasnodar.transport.settings.MapPreferences
import ru.khudob1n.krasnodar.transport.ui.components.TransportType
import kotlin.time.Clock
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Instant

/** Отрезок линии маршрута: color - ARGB, walk - пешком (пунктиром). */
data class JourneySegment(val points: List<LatLngPoint>, val color: Int, val walk: Boolean)

/** Линии маршрута «откуда - куда» и точки А и Б. */
data class JourneyLines(val segments: List<JourneySegment>, val a: LatLngPoint?, val b: LatLngPoint?)

sealed interface MapSelection {
    data class Vehicle(val deviceCode: String) : MapSelection
    data class Stop(val id: Long) : MapSelection
    data class Station(val id: String) : MapSelection
    data class Route(val routeId: Long, val subrouteId: Long) : MapSelection
    data object Nearby : MapSelection
}

/**
 * Настройки плотности - как components/Map/mapDensity.ts сайта, но на единицу меньше: у сайта
 * масштаб Leaflet (тайлы 256), у MapLibre тайлы 512, и тот же вид карты - масштаб на 1 меньше.
 */
private const val STOPS_MIN_ZOOM = 12f
private const val LABELS_MIN_ZOOM = 15f
private val STALE_AFTER = 5.minutes
/** Отступ подписи от центра значка остановки или вокзала при размере 100 %. */
private const val LABEL_OFFSET = 13f

fun vehicleSampleRate(zoom: Double) = when { zoom >= 15 -> 1; zoom >= 14 -> 2; zoom >= 13 -> 4; else -> 8 }
fun stopSampleRate(zoom: Double) = when { zoom >= 15 -> 1; zoom >= 14 -> 3; zoom >= 13 -> 8; else -> 16 }

/**
 * Прореживание на мелком масштабе (isSampledIn сайта). У сайта для нечисловых id ключ - длина
 * строки, и машины Краснодара (id - UUID) исчезали все разом; здесь - хэш id.
 */
private fun sampled(key: Long, rate: Int) = rate <= 1 || key.mod(rate.toLong()) == 0L

/** «Упрощённая» подложка - без этих слоёв стиля (SIMPLE_HIDDEN_LAYERS сайта). */
private val SIMPLE_HIDDEN_LAYERS = setOf("building", "building_number", "landuse_overlay", "highway_dash")

/**
 * Стиль подложки сайта. Глифы у сайта по относительному пути /fonts/... - нативному MapLibre нужен
 * полный адрес; «упрощённая» подложка - стиль без зданий и пунктиров.
 */
fun mapStyleJson(dark: Boolean, basemap: Basemap): String {
    val json = (if (dark) WebAssets.mapStyleDark else WebAssets.mapStyleLight)
        .replace("\"/fonts/{fontstack}/{range}.pbf\"", "\"${AppConfig.SHARE_BASE_URL}/fonts/{fontstack}/{range}.pbf\"")
    if (basemap == Basemap.Default) return json
    val style = kotlinx.serialization.json.Json.parseToJsonElement(json).jsonObject
    val layers = style.getValue("layers").jsonArray.filter { it.jsonObject["id"]?.jsonPrimitive?.content !in SIMPLE_HIDDEN_LAYERS }
    return JsonObject(style + ("layers" to kotlinx.serialization.json.JsonArray(layers))).toString()
}

/** Остановка видна, если включён слой её вида транспорта (MapStops сайта). */
private fun MapPreferences.showsStop(kind: StopKind) = layers.stops && when (kind) {
    StopKind.Bus -> layers.bus
    StopKind.Troll -> layers.troll
    StopKind.Tram -> layers.tram
    StopKind.TrollBus -> layers.bus || layers.troll
}

private fun MapPreferences.showsType(type: TransportType) = when (type) {
    TransportType.Bus -> layers.bus
    TransportType.Troll -> layers.troll
    TransportType.Tram -> layers.tram
}

private typealias Features = FeatureCollection<Geometry, JsonObject>

private fun features(list: List<Feature<Geometry, JsonObject>>): Features = FeatureCollection(list)

private fun point(lat: Double, lng: Double) = Point(Position(longitude = lng, latitude = lat))

private fun LatLngPoint.position() = Position(longitude = lng, latitude = lat)

/**
 * Какие машины показывать и как (фильтры и прореживание - как на сайте). filter - пары (маршрут,
 * направление): открыт маршрут - только его направление (shouldFilterByRouteDirection сайта);
 * построен маршрут «откуда - куда» - только машины его поездок. null - все.
 */
fun vehicleMarks(
    vehicles: List<Vehicle>,
    catalog: Catalog?,
    preferences: MapPreferences,
    filter: Set<Pair<Long, Long>>?,
    rate: Int,
): List<VehicleMark> {
    val now = Clock.System.now()
    return vehicles.mapNotNull { v ->
        val type = v.transport ?: return@mapNotNull null
        if (!preferences.showsType(type)) return@mapNotNull null
        if (preferences.lowFloorOnly && !v.lowFloor) return@mapNotNull null
        if (filter != null && (v.routeId to v.subrouteId) !in filter) return@mapNotNull null
        // Отобранных машин немного - прореживать их не нужно.
        if (filter == null && !sampled(v.deviceCode.hashCode().toLong(), rate)) return@mapNotNull null
        val stale = v.navTime?.let { runCatching { now - Instant.parse(it) > STALE_AFTER }.getOrNull() } ?: false
        if (stale && !preferences.showStale) return@mapNotNull null
        // Направления машины нет в справочнике - она не на линии маршрута (warning на сайте).
        val warning = catalog != null && catalog.routeStopsById[v.routeId]?.directions?.none { it.subrouteId == v.subrouteId } ?: true
        VehicleMark(v, type, stale, warning)
    }
}

/** Картинки слоёв по id вида "stop|bus|1" - рисует MarkerRenderer, когда карта их попросит. */
fun MarkerRenderer.imageFor(id: String) = runCatching {
    val p = id.split('|')
    when (p[0]) {
        "depotlabel" -> label(id.substringAfter('|').substringAfter('|'), p[1] == "1", maxWidthDp = 180f)
        "label" -> label(id.substringAfter('|').substringAfter('|'), p[1] == "1")
        else -> null
    }
}.getOrNull()

/**
 * Слои остановок, вокзалов, депо и линий поверх подложки (всё, кроме машин - они своим слоем,
 * VehicleLayer). Картинки значков рисует MarkerRenderer по запросу карты (imageFor).
 */
@Composable
fun TransportLayers(
    catalog: Catalog?,
    preferences: MapPreferences,
    dark: Boolean,
    stopRate: Int,
    route: Pair<List<LatLngPoint>, Int>?,
    journey: JourneyLines?,
    user: LatLngPoint?,
    renderer: MarkerRenderer,
    labelsVersion: Int,
    onSelect: (MapSelection) -> Unit,
) {
    val d = if (dark) 1 else 0
    val sizes = preferences.iconSizes
    // Значки видов остановок и вокзалов, метка «я здесь», точки A и B - картинками прямо в слое:
    // так они видны сразу. Подписи (их сотни) - по запросу карты, imageFor.
    val stopImages = remember(renderer, dark) { StopKind.entries.associateWith { renderer.stop(it, dark) } }
    val stationImages = remember(renderer, dark) { listOf("railway_station", "bus_terminal", "airport").associateWith { renderer.station(it, dark) } }
    val userImage = remember(renderer) { renderer.userPlacemark() }
    val markerA = remember(renderer) { renderer.journeyMarker("A") }
    val markerB = remember(renderer) { renderer.journeyMarker("B") }

    // Депо - полигоны цвета своего вида транспорта (MapDepots сайта), в самом низу.
    val depots = remember(catalog) {
        features(catalog?.depots.orEmpty().map { depot ->
            val rings = depot.polygons.map { ring -> ring.map { Position(longitude = it[1], latitude = it[0]) } }
            Feature(Polygon(rings), buildJsonObject {
                put("color", when (depot.type) { "tram" -> "#FF640F"; "troll" -> "#00B4FF"; else -> "#00B400" })
            })
        })
    }
    val depotLabels = remember(catalog, d, labelsVersion) {
        features(catalog?.depots.orEmpty().map { depot ->
            val ring = depot.polygons.first()
            Feature(point(ring.map { it[0] }.average(), ring.map { it[1] }.average()), buildJsonObject { put("label", "depotlabel|$d|${depot.name}") })
        })
    }
    val depotSource = rememberGeoJsonSource(GeoJsonData.Features(depots))
    val depotLabelSource = rememberGeoJsonSource(GeoJsonData.Features(depotLabels))
    FillLayer("depots-fill", depotSource, visible = preferences.layers.depots, color = feature["color"].asString().convertToColor(), opacity = const(0.14f))
    LineLayer("depots-line", depotSource, visible = preferences.layers.depots, color = feature["color"].asString().convertToColor(), width = const(2.dp), opacity = const(0.9f))
    SymbolLayer(
        "depot-labels", depotLabelSource, minZoom = LABELS_MIN_ZOOM, visible = preferences.layers.depots && preferences.labels,
        iconImage = image(feature["label"].asString()), iconAllowOverlap = const(false),
    )

    // Линия маршрута выбранной машины или маршрута - под значками, как на сайте.
    val routeFeatures = remember(route) {
        val (points, color) = route ?: (null to 0)
        features(if (points == null || points.size < 2) emptyList() else listOf(
            Feature(LineString(points.map { it.position() }), buildJsonObject { put("color", color.hexRgb()) }),
        ))
    }
    val routeSource = rememberGeoJsonSource(GeoJsonData.Features(routeFeatures))
    LineLayer(
        "selected-route-line", routeSource, color = feature["color"].asString().convertToColor(), width = const(5.dp),
        cap = const(LineCap.Round), join = const(LineJoin.Round), opacity = const(0.85f),
    )

    // Маршрут «откуда - куда»: поездки цветом транспорта, пешие отрезки пунктиром.
    val journeyFeatures = remember(journey) {
        features(journey?.segments.orEmpty().filter { it.points.size >= 2 }.map { seg ->
            Feature(LineString(seg.points.map { it.position() }), buildJsonObject {
                put("color", seg.color.hexRgb())
                put("walk", seg.walk)
            })
        })
    }
    val journeySource = rememberGeoJsonSource(GeoJsonData.Features(journeyFeatures))
    LineLayer(
        "journey-walks", journeySource, filter = feature["walk"].asBoolean() eq const(true),
        color = feature["color"].asString().convertToColor(), width = const(4.dp), cap = const(LineCap.Round),
        dasharray = const(listOf(0.1f, 1.8f)),
    )
    LineLayer(
        "journey-rides", journeySource, filter = feature["walk"].asBoolean() eq const(false),
        color = feature["color"].asString().convertToColor(), width = const(6.dp), cap = const(LineCap.Round), join = const(LineJoin.Round),
    )

    // Остановки: значок и подпись справа (картинкой - шрифт Onest, которого нет среди глифов
    // подложки). Налезающие друг на друга подписи MapLibre прячет сам (MapLabelCollisions сайта).
    val stops = remember(catalog, stopRate, preferences.layers, d, labelsVersion) {
        val c = catalog
        features(c?.stops.orEmpty().filter { sampled(it.id, stopRate) }.mapNotNull { stop ->
            val kind = stopKindOf(c?.stopTypes?.get(stop.id))
            if (!preferences.showsStop(kind)) return@mapNotNull null
            Feature(point(stop.lat, stop.lng), buildJsonObject {
                put("id", stop.id.toString())
                put("kind", kind.id)
                put("label", "label|$d|${stop.name}")
            })
        })
    }
    val stopSource = rememberGeoJsonSource(GeoJsonData.Features(stops))
    val openStop: (List<Feature<Geometry, JsonObject?>>) -> ClickResult = { hits ->
        hits.firstNotNullOfOrNull { it.properties?.get("id")?.jsonPrimitive?.content?.toLongOrNull() }
            ?.let { onSelect(MapSelection.Stop(it)); ClickResult.Consume } ?: ClickResult.Pass
    }
    SymbolLayer(
        "stops-icons", stopSource, minZoom = STOPS_MIN_ZOOM,
        iconImage = switch(feature["kind"], StopKind.entries.map { case(it.id, image(stopImages.getValue(it))) }, fallback = image(stopImages.getValue(StopKind.Bus))),
        iconSize = const(sizes.all * sizes.stops),
        iconAllowOverlap = const(true), iconIgnorePlacement = const(true), onClick = openStop,
    )
    SymbolLayer(
        "stops-labels", stopSource, minZoom = LABELS_MIN_ZOOM, visible = preferences.labels,
        iconImage = image(feature["label"].asString()), iconAnchor = const(SymbolAnchor.Left),
        iconOffset = const(DpOffset((LABEL_OFFSET * sizes.all * sizes.stops).dp, 0.dp)), iconAllowOverlap = const(false),
        onClick = openStop,
    )

    // Вокзалы, автовокзалы и аэропорт - над остановками, под машинами; видны на любом масштабе.
    val stations = remember(catalog, sizes, d, labelsVersion) {
        features(catalog?.railStations.orEmpty().map { st ->
            Feature(point(st.lat, st.lng), buildJsonObject {
                put("id", st.id)
                // Ползунки «Железнодорожные станции», «Аэропорт» и «Прочие объекты» (автовокзалы).
                put("scale", sizes.all * when (st.kind) { "railway_station" -> sizes.rail; "airport" -> sizes.airport; else -> sizes.other })
                put("kind", st.kind)
                put("label", "label|$d|${st.name}")
            })
        })
    }
    val stationSource = rememberGeoJsonSource(GeoJsonData.Features(stations))
    val openStation: (List<Feature<Geometry, JsonObject?>>) -> ClickResult = { hits ->
        hits.firstNotNullOfOrNull { it.properties?.get("id")?.jsonPrimitive?.content }
            ?.let { onSelect(MapSelection.Station(it)); ClickResult.Consume } ?: ClickResult.Pass
    }
    SymbolLayer(
        "stations-icons", stationSource, visible = preferences.layers.rail,
        iconImage = switch(feature["kind"], stationImages.map { (kind, bmp) -> case(kind, image(bmp)) }, fallback = image(stationImages.getValue("railway_station"))),
        iconSize = feature["scale"].asNumber(),
        iconAllowOverlap = const(true), iconIgnorePlacement = const(true), onClick = openStation,
    )
    // Подпись стоит справа от значка: крупнее значок - дальше подпись. Отступ - по ж/д станциям.
    SymbolLayer(
        "stations-labels", stationSource, minZoom = LABELS_MIN_ZOOM, visible = preferences.layers.rail && preferences.labels,
        iconImage = image(feature["label"].asString()), iconAnchor = const(SymbolAnchor.Left),
        iconOffset = const(DpOffset((LABEL_OFFSET * sizes.all * sizes.rail).dp, 0.dp)), iconAllowOverlap = const(false),
        onClick = openStation,
    )

    // Метка «я здесь» (user-placemark.svg сайта, 58x60, точка - в (36, 30)).
    val userFeatures = remember(user) { features(listOfNotNull(user?.let { Feature(point(it.lat, it.lng), JsonObject(emptyMap())) })) }
    SymbolLayer(
        "user-placemark", rememberGeoJsonSource(GeoJsonData.Features(userFeatures)),
        iconImage = image(userImage), iconAnchor = const(SymbolAnchor.TopLeft), iconOffset = const(DpOffset((-36).dp, (-30).dp)),
        iconAllowOverlap = const(true), iconIgnorePlacement = const(true),
    )

    val journeyPoints = remember(journey) {
        features(listOfNotNull(journey?.a?.let { it to "A" }, journey?.b?.let { it to "B" }).map { (p, letter) ->
            Feature(point(p.lat, p.lng), buildJsonObject { put("letter", letter) })
        })
    }
    SymbolLayer(
        "journey-points", rememberGeoJsonSource(GeoJsonData.Features(journeyPoints)),
        iconImage = switch(feature["letter"], listOf(case("A", image(markerA))), fallback = image(markerB)),
        iconAllowOverlap = const(true), iconIgnorePlacement = const(true),
    )
}
