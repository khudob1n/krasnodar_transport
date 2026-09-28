package ru.khudob1n.krasnodar.transport.map

import android.graphics.RectF
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.style.layers.FillLayer
import org.maplibre.android.style.layers.LineLayer
import org.maplibre.android.style.layers.PropertyFactory.fillColor
import org.maplibre.android.style.layers.PropertyFactory.fillOpacity
import org.maplibre.geojson.Polygon
import org.maplibre.android.style.layers.PropertyFactory.lineCap
import org.maplibre.android.style.layers.PropertyFactory.lineColor
import org.maplibre.android.style.layers.PropertyFactory.lineJoin
import org.maplibre.android.style.layers.PropertyFactory.lineOpacity
import org.maplibre.android.style.layers.PropertyFactory.lineWidth
import org.maplibre.geojson.LineString
import ru.khudob1n.krasnodar.transport.data.LatLngPoint
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import org.maplibre.android.style.expressions.Expression.get
import org.maplibre.android.style.expressions.Expression.toColor
import org.maplibre.android.style.layers.PropertyFactory.iconAllowOverlap
import org.maplibre.android.style.layers.PropertyFactory.iconAnchor
import org.maplibre.android.style.layers.PropertyFactory.iconOffset
import org.maplibre.android.style.layers.PropertyFactory.iconIgnorePlacement
import org.maplibre.android.style.layers.PropertyFactory.iconImage
import org.maplibre.android.style.layers.Property
import org.maplibre.android.style.layers.SymbolLayer
import org.maplibre.android.style.sources.GeoJsonSource
import org.maplibre.geojson.Feature
import org.maplibre.geojson.FeatureCollection
import org.maplibre.geojson.Point
import ru.khudob1n.krasnodar.transport.data.Catalog
import ru.khudob1n.krasnodar.transport.data.Vehicle
import ru.khudob1n.krasnodar.transport.settings.Basemap
import ru.khudob1n.krasnodar.transport.settings.MapPreferences
import ru.khudob1n.krasnodar.transport.ui.components.TransportType
import org.maplibre.android.style.layers.PropertyFactory.iconSize
import org.maplibre.android.style.layers.PropertyFactory.visibility
import org.maplibre.android.style.layers.PropertyFactory.lineDasharray
import java.time.Duration
import java.time.Instant

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
private const val STOPS_MIN_ZOOM = 12.0
private const val LABELS_MIN_ZOOM = 15.0
private val STALE_AFTER: Duration = Duration.ofMinutes(5)
/** Отступ подписи от центра значка остановки или вокзала при размере 100 %. */
private const val LABEL_OFFSET = 13f

private fun vehicleSampleRate(zoom: Double) = when { zoom >= 15 -> 1; zoom >= 14 -> 2; zoom >= 13 -> 4; else -> 8 }
private fun stopSampleRate(zoom: Double) = when { zoom >= 15 -> 1; zoom >= 14 -> 3; zoom >= 13 -> 8; else -> 16 }

/**
 * Прореживание на мелком масштабе (isSampledIn сайта). У сайта для нечисловых id ключ - длина
 * строки, и машины Краснодара (id - UUID) исчезали все разом; здесь - хэш id.
 */
private fun sampled(key: Long, rate: Int) = rate <= 1 || Math.floorMod(key, rate.toLong()) == 0L

/** «Упрощённая» подложка - без этих слоёв стиля (SIMPLE_HIDDEN_LAYERS сайта). */
private val SIMPLE_HIDDEN_LAYERS = listOf("building", "building_number", "landuse_overlay", "highway_dash")

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

/**
 * Слои остановок и машин поверх подложки. Держит данные и переставляет их при смене стиля
 * (тема) и масштаба; картинки маркеров рисует MarkerRenderer по требованию карты.
 */
class MapLayers(private val mapView: MapView, private val map: MapLibreMap, private val renderer: MarkerRenderer) {
    private var catalog: Catalog? = null
    private var vehicles: List<Vehicle> = emptyList()

    /** Машины - своим слоем поверх карты (см. VehicleOverlay). */
    private val overlay = VehicleOverlay(mapView.context, map, renderer).also {
        mapView.addView(it, android.view.ViewGroup.LayoutParams(android.view.ViewGroup.LayoutParams.MATCH_PARENT, android.view.ViewGroup.LayoutParams.MATCH_PARENT))
    }
    private var dark = false
    private var stopRate = -1
    private var vehicleRate = -1

    /** Нажатие по машине или остановке; null - по пустому месту карты. */
    var onSelect: ((MapSelection?) -> Unit)? = null
    private var route: Pair<List<LatLngPoint>, Int>? = null
    private var journey: JourneyLines? = null
    private var user: LatLngPoint? = null

    /** Настройки карты: что показывать, подписи, размеры меток, подложка. */
    var preferences = MapPreferences()
        set(value) {
            if (android.os.Looper.myLooper() != android.os.Looper.getMainLooper()) { mapView.post { preferences = value }; return }
            val old = field
            field = value
            applyPreferences()
            if (old.layers != value.layers) { stopRate = -1; onZoom(); pushStatic() }
            if (old.layers != value.layers || old.lowFloorOnly != value.lowFloorOnly || old.showStale != value.showStale) pushVehicles()
            animationsEnabled = !value.reduceMotion
        }

    /** «Указать на карте» в маршруте: следующее нажатие по карте - точка, а не выбор объекта. */
    var onPickPoint: ((LatLngPoint) -> Unit)? = null

    init {
        map.addOnMapClickListener { latLng ->
            onPickPoint?.let { pick -> pick(LatLngPoint(latLng.latitude, latLng.longitude)); return@addOnMapClickListener true }
            val p = map.projection.toScreenLocation(latLng)
            val r = 14f * mapView.resources.displayMetrics.density
            // Машина важнее остановки под ней (машины нарисованы выше).
            val vehicle = overlay.vehicleAt(p.x, p.y)
            val features = map.queryRenderedFeatures(
                RectF(p.x - r, p.y - r, p.x + r, p.y + r),
                STATIONS_LAYER, STATION_LABELS_LAYER, STOPS_LAYER, STOP_LABELS_LAYER,
            )
            val stop = features.firstOrNull { it.getStringProperty("kind") == "stop" }
            val station = features.firstOrNull { it.getStringProperty("kind") == "station" }
            onSelect?.invoke(
                when {
                    vehicle != null -> MapSelection.Vehicle(vehicle)
                    station != null -> MapSelection.Station(station.getStringProperty("id"))
                    stop != null -> MapSelection.Stop(stop.getStringProperty("id").toLong())
                    else -> null
                },
            )
            true
        }
        // Картинка с id вида "stop|bus|1" нужна слою - рисуем по id и отдаём стилю.
        mapView.addOnStyleImageMissingListener { id ->
            val style = map.style ?: return@addOnStyleImageMissingListener
            imageFor(id)?.let { style.addImage(id, it) }
        }
        map.addOnCameraIdleListener { onZoom() }
    }

    /** MapLibre меняет источники только из главного потока; вызов из другого - переносим туда. */
    private fun onMain(block: () -> Unit) {
        if (android.os.Looper.myLooper() == android.os.Looper.getMainLooper()) block() else mapView.post(block)
    }

    /** Вызывается после каждой загрузки стиля (в т.ч. смены темы). */
    fun install(style: Style, dark: Boolean) {
        this.dark = dark
        overlay.dark = dark
        // Депо - полигоны цвета своего вида транспорта (MapDepots сайта), в самом низу.
        style.addSource(GeoJsonSource(DEPOTS))
        style.addLayer(FillLayer(DEPOTS_FILL_LAYER, DEPOTS).withProperties(fillColor(toColor(get("color"))), fillOpacity(0.14f)))
        style.addLayer(LineLayer(DEPOTS_LINE_LAYER, DEPOTS).withProperties(lineColor(toColor(get("color"))), lineWidth(2f), lineOpacity(0.9f)))
        style.addSource(GeoJsonSource(DEPOT_LABELS))
        style.addLayer(
            SymbolLayer(DEPOT_LABELS_LAYER, DEPOT_LABELS).withProperties(iconImage(get("label")), iconAllowOverlap(false))
                .also { it.minZoom = LABELS_MIN_ZOOM.toFloat() },
        )
        style.addSource(GeoJsonSource(ROUTE))
        // Линия маршрута выбранной машины - под маркерами, как на сайте.
        style.addLayer(
            LineLayer(ROUTE_LAYER, ROUTE).withProperties(
                lineColor(toColor(get("color"))), lineWidth(5f), lineCap(Property.LINE_CAP_ROUND), lineJoin(Property.LINE_JOIN_ROUND),
                lineOpacity(0.85f),
            ),
        )
        // Маршрут «откуда - куда»: поездки цветом транспорта, пешие отрезки пунктиром.
        style.addSource(GeoJsonSource(JOURNEY))
        style.addLayer(
            LineLayer(JOURNEY_WALK_LAYER, JOURNEY).withProperties(
                lineColor(toColor(get("color"))), lineWidth(4f), lineCap(Property.LINE_CAP_ROUND), lineDasharray(arrayOf(0.1f, 1.8f)),
            ).also { it.setFilter(org.maplibre.android.style.expressions.Expression.eq(get("walk"), true)) },
        )
        style.addLayer(
            LineLayer(JOURNEY_RIDE_LAYER, JOURNEY).withProperties(
                lineColor(toColor(get("color"))), lineWidth(6f), lineCap(Property.LINE_CAP_ROUND), lineJoin(Property.LINE_JOIN_ROUND),
            ).also { it.setFilter(org.maplibre.android.style.expressions.Expression.eq(get("walk"), false)) },
        )
        style.addSource(GeoJsonSource(STOPS))
        style.addLayer(
            SymbolLayer(STOPS_LAYER, STOPS).withProperties(
                iconImage(get("image")), iconAllowOverlap(true), iconIgnorePlacement(true),
            ).also { it.minZoom = STOPS_MIN_ZOOM.toFloat() },
        )
        // Подписи - картинками (MarkerRenderer.label): шрифт Onest, которого нет среди глифов
        // подложки. Налезающие друг на друга MapLibre прячет сам (на сайте - MapLabelCollisions).
        style.addLayer(
            SymbolLayer(STOP_LABELS_LAYER, STOPS).withProperties(
                iconImage(get("label")),
                iconAnchor(Property.ICON_ANCHOR_LEFT),
                iconOffset(arrayOf(LABEL_OFFSET, 0f)),
                iconAllowOverlap(false),
            ).also { it.minZoom = LABELS_MIN_ZOOM.toFloat() },
        )
        // Вокзалы, автовокзалы и аэропорт - над остановками, под машинами; видны на любом масштабе.
        style.addSource(GeoJsonSource(STATIONS))
        style.addLayer(SymbolLayer(STATIONS_LAYER, STATIONS).withProperties(iconImage(get("image")), iconAllowOverlap(true), iconIgnorePlacement(true)))
        style.addLayer(
            SymbolLayer(STATION_LABELS_LAYER, STATIONS).withProperties(
                iconImage(get("label")), iconAnchor(Property.ICON_ANCHOR_LEFT), iconOffset(arrayOf(LABEL_OFFSET, 0f)), iconAllowOverlap(false),
            ).also { it.minZoom = LABELS_MIN_ZOOM.toFloat() },
        )
        // Метка «я здесь» (user-placemark.svg сайта, 58x60, точка - в (36, 30)).
        style.addSource(GeoJsonSource(USER))
        style.addLayer(
            SymbolLayer(USER_LAYER, USER).withProperties(
                iconImage("user|0"), iconAnchor(Property.ICON_ANCHOR_TOP_LEFT), iconOffset(arrayOf(-36f, -30f)),
                iconAllowOverlap(true), iconIgnorePlacement(true),
            ),
        )
        style.addSource(GeoJsonSource(JOURNEY_POINTS))
        style.addLayer(SymbolLayer(JOURNEY_POINTS_LAYER, JOURNEY_POINTS).withProperties(iconImage(get("image")), iconAllowOverlap(true), iconIgnorePlacement(true)))
        stopRate = -1
        vehicleRate = -1
        applyPreferences()
        onZoom()
        pushRoute()
        pushStatic()
        pushUser()
        pushJourney()
    }

    /** Видимость и размеры слоёв - по настройкам; вызывается и после смены стиля. */
    private fun applyPreferences() {
        val style = map.style ?: return
        if (!style.isFullyLoaded) return
        val p = preferences
        fun show(on: Boolean) = visibility(if (on) Property.VISIBLE else Property.NONE)
        val sizes = p.iconSizes
        style.getLayer(DEPOTS_FILL_LAYER)?.setProperties(show(p.layers.depots))
        style.getLayer(DEPOTS_LINE_LAYER)?.setProperties(show(p.layers.depots))
        style.getLayer(DEPOT_LABELS_LAYER)?.setProperties(show(p.layers.depots && p.labels))
        style.getLayer(STATIONS_LAYER)?.setProperties(show(p.layers.rail), iconSize(get("scale")))
        // Подпись стоит справа от значка: крупнее значок - дальше подпись. У вокзалов разные
        // ползунки по видам, отступ - по ж/д станциям, их в городе больше всего.
        style.getLayer(STATION_LABELS_LAYER)?.setProperties(show(p.layers.rail && p.labels), iconOffset(arrayOf(LABEL_OFFSET * sizes.all * sizes.rail, 0f)))
        style.getLayer(STOPS_LAYER)?.setProperties(iconSize(sizes.all * sizes.stops))
        style.getLayer(STOP_LABELS_LAYER)?.setProperties(show(p.labels), iconOffset(arrayOf(LABEL_OFFSET * sizes.all * sizes.stops, 0f)))
        val vehicleSize = sizes.all * sizes.vehicles
        overlay.scale = vehicleSize
        for (id in SIMPLE_HIDDEN_LAYERS) style.getLayer(id)?.setProperties(show(p.basemap == Basemap.Default))
        // Масштаб вокзалов зависит от вида - он в свойстве "scale" каждой точки.
        pushStatic()
    }

    fun setUser(point: LatLngPoint?) {
        onMain {
            user = point
            pushUser()
        }
    }

    private fun pushUser() {
        val style = map.style ?: return
        if (!style.isFullyLoaded) return
        val features = user?.let { listOf(Feature.fromGeometry(Point.fromLngLat(it.lng, it.lat))) }.orEmpty()
        style.getSourceAs<GeoJsonSource>(USER)?.setGeoJson(FeatureCollection.fromFeatures(features))
    }

    /** Депо и вокзалы - из справочника, от масштаба не зависят. */
    private fun pushStatic() {
        val style = map.style ?: return
        if (!style.isFullyLoaded) return
        val catalog = catalog ?: return
        val d = if (dark) 1 else 0
        val depots = catalog.depots.map { depot ->
            val rings = depot.polygons.map { ring -> ring.map { Point.fromLngLat(it[1], it[0]) } }
            Feature.fromGeometry(Polygon.fromLngLats(rings)).apply {
                addStringProperty("color", when (depot.type) { "tram" -> "#FF640F"; "troll" -> "#00B4FF"; else -> "#00B400" })
            }
        }
        style.getSourceAs<GeoJsonSource>(DEPOTS)?.setGeoJson(FeatureCollection.fromFeatures(depots))
        val depotLabels = catalog.depots.map { depot ->
            val ring = depot.polygons.first()
            Feature.fromGeometry(Point.fromLngLat(ring.map { it[1] }.average(), ring.map { it[0] }.average())).apply {
                addStringProperty("label", "depotlabel|$d|${depot.name}")
            }
        }
        style.getSourceAs<GeoJsonSource>(DEPOT_LABELS)?.setGeoJson(FeatureCollection.fromFeatures(depotLabels))
        val sizes = preferences.iconSizes
        val stations = catalog.railStations.map { st ->
            Feature.fromGeometry(Point.fromLngLat(st.lng, st.lat)).apply {
                addStringProperty("id", st.id)
                // Ползунки «Железнодорожные станции», «Аэропорт» и «Прочие объекты» (автовокзалы).
                addNumberProperty("scale", sizes.all * when (st.kind) { "railway_station" -> sizes.rail; "airport" -> sizes.airport; else -> sizes.other })
                addStringProperty("kind", "station")
                addStringProperty("image", "station|${st.kind}|$d")
                addStringProperty("label", "label|$d|${st.name}")
            }
        }
        style.getSourceAs<GeoJsonSource>(STATIONS)?.setGeoJson(FeatureCollection.fromFeatures(stations))
    }

    /** Линия выбранного маршрута (или null - убрать). color - ARGB цвета вида транспорта. */
    fun setRoute(points: List<LatLngPoint>?, color: Int) {
        onMain {
            route = points?.let { it to color }
            pushRoute()
        }
    }

    private fun pushRoute() {
        val style = map.style ?: return
        if (!style.isFullyLoaded) return
        val (points, color) = route ?: (null to 0)
        val features = if (points == null || points.size < 2) emptyList() else listOf(
            Feature.fromGeometry(LineString.fromLngLats(points.map { Point.fromLngLat(it.lng, it.lat) })).apply {
                addStringProperty("color", String.format("#%06X", color and 0xFFFFFF))
            },
        )
        style.getSourceAs<GeoJsonSource>(ROUTE)?.setGeoJson(FeatureCollection.fromFeatures(features))
    }

    /** Линии маршрута «откуда - куда» и метки А/Б; null - убрать. */
    fun setJourney(lines: JourneyLines?) {
        onMain {
            journey = lines
            pushJourney()
        }
    }

    private fun pushJourney() {
        val style = map.style ?: return
        if (!style.isFullyLoaded) return
        val j = journey
        val lines = j?.segments.orEmpty().filter { it.points.size >= 2 }.map { seg ->
            Feature.fromGeometry(LineString.fromLngLats(seg.points.map { Point.fromLngLat(it.lng, it.lat) })).apply {
                addStringProperty("color", String.format("#%06X", seg.color and 0xFFFFFF))
                addBooleanProperty("walk", seg.walk)
            }
        }
        style.getSourceAs<GeoJsonSource>(JOURNEY)?.setGeoJson(FeatureCollection.fromFeatures(lines))
        val points = listOfNotNull(j?.a?.let { it to "A" }, j?.b?.let { it to "B" }).map { (p, letter) ->
            Feature.fromGeometry(Point.fromLngLat(p.lng, p.lat)).apply { addStringProperty("image", "jm|$letter") }
        }
        style.getSourceAs<GeoJsonSource>(JOURNEY_POINTS)?.setGeoJson(FeatureCollection.fromFeatures(points))
    }

    fun setCatalog(catalog: Catalog?) {
        onMain {
            this.catalog = catalog
            stopRate = -1
            onZoom()
            pushStatic()
        }
    }

    fun setVehicles(vehicles: List<Vehicle>) {
        onMain {
            this.vehicles = vehicles
            pushVehicles()
        }
    }

    /**
     * Какие машины показывать: пары (маршрут, направление). Открыт маршрут - только его
     * направление (shouldFilterByRouteDirection сайта); построен маршрут «откуда - куда» -
     * только машины его поездок. null - все.
     */
    var vehicleFilter: Set<Pair<Long, Long>>? = null
        set(value) { if (field != value) { field = value; onMain { pushVehicles() } } }

    /** «Уменьшить движение» в настройках: машины переставляются без анимации. */
    var animationsEnabled: Boolean
        get() = overlay.animate
        set(value) { overlay.animate = value }

    /** «Наблюдать за движением»: камера держит эту машину в центре, пока та едет. */
    fun follow(deviceCode: String?) = onMain { overlay.follow = deviceCode }

    /** Где машина нарисована сейчас (она едет к последним координатам плавно). */
    fun displayedPosition(deviceCode: String): LatLngPoint? = overlay.position(deviceCode)

    private fun pushVehicles() {
        if (vehicleRate < 0) return
        overlay.setMarks(vehicleMarks(vehicleRate))
    }

    private fun onZoom() {
        val style = map.style ?: return
        if (!style.isFullyLoaded) return
        val zoom = map.cameraPosition.zoom
        val sRate = stopSampleRate(zoom)
        if (sRate != stopRate) {
            stopRate = sRate
            style.getSourceAs<GeoJsonSource>(STOPS)?.setGeoJson(stopFeatures(sRate))
        }
        val vRate = vehicleSampleRate(zoom)
        if (vRate != vehicleRate) {
            vehicleRate = vRate
            pushVehicles()
        }
    }

    private fun stopFeatures(rate: Int): FeatureCollection {
        val catalog = catalog ?: return FeatureCollection.fromFeatures(emptyList())
        val features = catalog.stops.filter { sampled(it.id, rate) }.mapNotNull { stop ->
            val kind = stopKindOf(catalog.stopTypes[stop.id])
            if (!preferences.showsStop(kind)) return@mapNotNull null
            Feature.fromGeometry(Point.fromLngLat(stop.lng, stop.lat)).apply {
                addStringProperty("id", stop.id.toString())
                addStringProperty("kind", "stop")
                addStringProperty("name", stop.name)
                addStringProperty("image", "stop|${kind.id}|${if (dark) 1 else 0}")
                addStringProperty("label", "label|${if (dark) 1 else 0}|${stop.name}")
            }
        }
        return FeatureCollection.fromFeatures(features)
    }

    private fun vehicleMarks(rate: Int): List<VehicleMark> {
        val catalog = catalog
        val now = Instant.now()
        val filter = vehicleFilter
        return vehicles.mapNotNull { v ->
            val type = v.transport ?: return@mapNotNull null
            if (!preferences.showsType(type)) return@mapNotNull null
            if (preferences.lowFloorOnly && !v.lowFloor) return@mapNotNull null
            if (filter != null && (v.routeId to v.subrouteId) !in filter) return@mapNotNull null
            // Отобранных машин немного - прореживать их не нужно.
            if (filter == null && !sampled(v.deviceCode.hashCode().toLong(), rate)) return@mapNotNull null
            val stale = v.navTime?.let { runCatching { Duration.between(Instant.parse(it), now) > STALE_AFTER }.getOrNull() } ?: false
            if (stale && !preferences.showStale) return@mapNotNull null
            // Направления машины нет в справочнике - она не на линии маршрута (warning на сайте).
            val warning = catalog != null && catalog.routeStopsById[v.routeId]?.directions?.none { it.subrouteId == v.subrouteId } ?: true
            VehicleMark(v, type, stale, warning)
        }
    }

    private fun imageFor(id: String) = runCatching {
        val p = id.split('|')
        when (p[0]) {
            "user" -> renderer.userPlacemark()
            "jm" -> renderer.journeyMarker(p[1])
            "depotlabel" -> renderer.label(id.substringAfter('|').substringAfter('|'), p[1] == "1", maxWidthDp = 180f)
            "station" -> renderer.station(p[1], p[2] == "1")
            "label" -> renderer.label(id.substringAfter('|').substringAfter('|'), p[1] == "1")
            "stop" -> renderer.stop(StopKind.entries.first { it.id == p[1] }, p[2] == "1")
            else -> null
        }
    }.getOrNull()

    companion object {
        const val DEPOTS = "depots"
        const val DEPOTS_FILL_LAYER = "depots-fill"
        const val DEPOTS_LINE_LAYER = "depots-line"
        const val DEPOT_LABELS = "depot-labels"
        const val DEPOT_LABELS_LAYER = "depot-labels-text"
        const val STATIONS = "stations"
        const val STATIONS_LAYER = "stations-icons"
        const val STATION_LABELS_LAYER = "stations-labels"
        const val JOURNEY = "journey"
        const val JOURNEY_RIDE_LAYER = "journey-rides"
        const val JOURNEY_WALK_LAYER = "journey-walks"
        const val JOURNEY_POINTS = "journey-points"
        const val JOURNEY_POINTS_LAYER = "journey-points-icons"
        const val USER = "user"
        const val USER_LAYER = "user-placemark"
        const val ROUTE = "selected-route"
        const val ROUTE_LAYER = "selected-route-line"
        const val STOPS = "stops"
        const val STOPS_LAYER = "stops-icons"
        const val STOP_LABELS_LAYER = "stops-labels"
    }
}
