package ru.khudob1n.krasnodar.transport.map

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.delay
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.ui.Alignment
import ru.khudob1n.krasnodar.transport.data.Vehicle
import ru.khudob1n.krasnodar.transport.ui.cards.RouteCard
import ru.khudob1n.krasnodar.transport.data.LatLngPoint
import ru.khudob1n.krasnodar.transport.ui.cards.NearbyCard
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import ru.khudob1n.krasnodar.transport.domain.DEFAULT_TYPING_EXAMPLES
import ru.khudob1n.krasnodar.transport.domain.typingExamples
import ru.khudob1n.krasnodar.transport.settings.SearchHistoryStore
import ru.khudob1n.krasnodar.transport.ui.search.SearchPick
import ru.khudob1n.krasnodar.transport.ui.search.SearchScreen
import ru.khudob1n.krasnodar.transport.ui.search.historyEntry
import ru.khudob1n.krasnodar.transport.ui.search.rememberTypingPlaceholder
import ru.khudob1n.krasnodar.transport.ui.cards.StationCard
import ru.khudob1n.krasnodar.transport.ui.cards.StopCard
import ru.khudob1n.krasnodar.transport.ui.cards.VehicleCard
import ru.khudob1n.krasnodar.transport.ui.components.Sidepage
import ru.khudob1n.krasnodar.transport.ui.components.TransportType
import androidx.compose.runtime.CompositionLocalProvider
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import ru.khudob1n.krasnodar.transport.settings.LastView
import ru.khudob1n.krasnodar.transport.settings.LocalMapPreferences
import ru.khudob1n.krasnodar.transport.settings.StartView
import ru.khudob1n.krasnodar.transport.ui.settings.SettingsCard
import ru.khudob1n.krasnodar.transport.settings.Favorites
import ru.khudob1n.krasnodar.transport.settings.FavoritesState
import ru.khudob1n.krasnodar.transport.settings.LocalFavorites
import ru.khudob1n.krasnodar.transport.ui.components.FavoriteButton
import ru.khudob1n.krasnodar.transport.ui.favorites.FavoritesPanel
import ru.khudob1n.krasnodar.transport.ui.settings.FavoritesTransfer
import ru.khudob1n.krasnodar.transport.data.Article
import ru.khudob1n.krasnodar.transport.ui.info.ArticleCard
import ru.khudob1n.krasnodar.transport.ui.info.WelcomeCard
import androidx.compose.material3.Text
import androidx.compose.runtime.mutableStateMapOf
import ru.khudob1n.krasnodar.transport.data.WalkRoute
import ru.khudob1n.krasnodar.transport.domain.JourneyPoint
import ru.khudob1n.krasnodar.transport.domain.insideCity
import ru.khudob1n.krasnodar.transport.ui.journey.JourneyCard
import ru.khudob1n.krasnodar.transport.ui.journey.JourneyController
import ru.khudob1n.krasnodar.transport.ui.journey.JourneyField
import ru.khudob1n.krasnodar.transport.ui.journey.JourneyPick
import ru.khudob1n.krasnodar.transport.ui.journey.JourneyPicker
import ru.khudob1n.krasnodar.transport.ui.journey.journeyLines
import ru.khudob1n.krasnodar.transport.ui.journey.walkKey
import ru.khudob1n.krasnodar.transport.ui.journey.walkPairs
import ru.khudob1n.krasnodar.transport.ui.search.nextStopName
import ru.khudob1n.krasnodar.transport.ui.theme.ThemePreference
import androidx.compose.ui.backhandler.BackHandler
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.runtime.derivedStateOf
import io.ktor.http.Url
import org.maplibre.compose.camera.CameraPosition
import org.maplibre.compose.interaction.ClickResult
import org.maplibre.compose.interaction.MapInteractions
import org.maplibre.compose.map.CameraConstraints
import org.maplibre.compose.map.MapEvent
import org.maplibre.compose.map.MaplibreMap
import org.maplibre.compose.map.MapUiOptions
import org.maplibre.compose.map.ResolvedStyleImage
import org.maplibre.compose.map.rememberMapState
import org.maplibre.compose.style.BaseStyle
import org.maplibre.spatialk.geojson.BoundingBox
import org.maplibre.spatialk.geojson.Position
import ru.khudob1n.krasnodar.transport.AppGraph
import ru.khudob1n.krasnodar.transport.platform.hasLocationPermission
import ru.khudob1n.krasnodar.transport.platform.locationUpdates
import ru.khudob1n.krasnodar.transport.platform.rememberLocationPermissionRequest
import ru.khudob1n.krasnodar.transport.ui.components.screenWidthDp

/** Справочные карточки: приветствие с обозначениями или статья (slug из site/faq_articles). */
private sealed interface InfoPanel {
    data object Welcome : InfoPanel
    data class ArticlePage(val slug: String) : InfoPanel
}

private const val VEHICLES_REFRESH_MS = 5_000L
private const val FAR_NOTE = "Вы сейчас не в Краснодаре — найдите адрес или остановку поиском."
private const val DENIED_NOTE = "Местоположение недоступно — найдите адрес или остановку поиском."
// «Уменьшить движение»: машины переставляются раз в 30 секунд (как на сайте).
private const val VEHICLES_REFRESH_REDUCED_MS = 30_000L

@OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class)
@Composable
fun MapScreen(
    link: String?,
    onLinkHandled: () -> Unit,
    theme: ThemePreference,
    onThemeChange: (ThemePreference) -> Unit,
    onToggleTheme: () -> Unit,
    onResetAll: suspend () -> Unit,
    modifier: Modifier = Modifier,
) {
    val dark = AppTheme.colors.isDark
    val repository = AppGraph.repository
    val catalog by repository.catalog.collectAsState()
    val preferencesStore = AppGraph.mapPreferences
    // Настройки и последнее место читаем до первого кадра: от них зависит, где открыть карту.
    val initialPreferences = remember { runBlocking { preferencesStore.preferences.first() } }
    val initialLastView = remember { runBlocking { preferencesStore.lastView() } }
    val preferences by preferencesStore.preferences.collectAsState(initial = initialPreferences)
    var settingsOpen by remember { mutableStateOf(false) }
    val favoritesStore = AppGraph.favorites
    val favorites by favoritesStore.favorites.collectAsState(initial = Favorites())
    // Панель избранного на телефоне открывается звёздочкой и не запоминается (как на сайте).
    var favoritesOpen by remember { mutableStateOf(false) }
    // Первый запуск - сразу приветствие, как на сайте. Отметка ставится, когда его закрыли:
    // на первом запуске экран может пересоздаться, и одноразовый флаг терялся бы вместе с ним.
    var info by remember { mutableStateOf<InfoPanel?>(if (runBlocking { preferencesStore.welcomeShown() }) null else InfoPanel.Welcome) }
    LaunchedEffect(info) { if (info != InfoPanel.Welcome) preferencesStore.markWelcomeShown() }
    var articles by remember { mutableStateOf<List<Article>?>(null) }
    var articlesFailed by remember { mutableStateOf(false) }
    LaunchedEffect(info) {
        if (info is InfoPanel.ArticlePage && articles == null) {
            articlesFailed = false
            runCatching { repository.articles() }.onSuccess { articles = it }.onFailure { articlesFailed = true }
        }
    }
    var vehicles by remember { mutableStateOf<List<Vehicle>>(emptyList()) }
    var selection by remember { mutableStateOf<MapSelection?>(null) }
    var following by remember { mutableStateOf(false) }
    var searchOpen by remember { mutableStateOf(false) }
    // «Где я»: следим за положением, пока включено (map.locate({ watch: true }) сайта).
    var tracking by remember { mutableStateOf(false) }
    var userLocation by remember { mutableStateOf<LatLngPoint?>(null) }
    var locationDenied by remember { mutableStateOf(false) }
    var pendingNearby by remember { mutableStateOf(false) }
    var locationPickField by remember { mutableStateOf<JourneyField?>(null) }
    // Почему «Моё местоположение» не подставилось (как подсказки под полем на сайте).
    var journeyNote by remember { mutableStateOf<String?>(null) }
    val requestLocation = rememberLocationPermissionRequest { granted ->
        if (granted) tracking = true else { locationDenied = true; if (locationPickField != null) { locationPickField = null; journeyNote = DENIED_NOTE } }
        if (pendingNearby) { selection = MapSelection.Nearby; pendingNearby = false }
    }
    val historyStore = AppGraph.history
    val history by historyStore.entries.collectAsState(initial = emptyList())
    val scope = rememberCoroutineScope()

    // Карта: подложка сайта, над ней слои остановок и линий (TransportLayers) и машины своим слоем.
    // «Где открывать карту»: центр, последнее место или «где я» (метка появится с первым ответом).
    val initialCamera = remember {
        val last = initialLastView.takeIf { initialPreferences.startView == StartView.Last }
        CameraPosition(
            target = Position(longitude = last?.lng ?: City.center.lng, latitude = last?.lat ?: City.center.lat),
            zoom = last?.zoom ?: City.DEFAULT_ZOOM,
        )
    }
    var mapClick by remember { mutableStateOf<(MapSelection?) -> Unit>({}) }
    var routeLine by remember { mutableStateOf<Pair<List<LatLngPoint>, Int>?>(null) }
    var journeyShown by remember { mutableStateOf<JourneyLines?>(null) }
    var stopRate by remember { mutableStateOf(stopSampleRate(initialCamera.zoom)) }
    val renderer = rememberMarkerRenderer()
    // Подписи карта просит по одной; готовые подхватывает только при следующей раскладке значков.
    // Когда подписи подгрузились, обновляем данные слоёв - карта раскладывает их заново.
    var labelsVersion by remember { mutableStateOf(0) }
    var labelsBump by remember { mutableStateOf<kotlinx.coroutines.Job?>(null) }
    val mapState = rememberMapState(
        baseStyle = BaseStyle.Json(remember(dark, preferences.basemap) { mapStyleJson(dark, preferences.basemap) }),
        initialCameraPosition = initialCamera,
    ) {
        TransportLayers(catalog, preferences, dark, stopRate, routeLine, journeyShown, userLocation, renderer, labelsVersion, onSelect = { mapClick(it) })
    }
    val camera = remember(mapState) { MapCamera(mapState, scope) }
    val vehicleLayer = remember { VehicleLayer() }
    LaunchedEffect(mapState, renderer) { mapState.missingImageResolver = { id ->
            val image = renderer.imageFor(id)
            labelsBump?.cancel()
            labelsBump = scope.launch { delay(250); labelsVersion++ }
            image?.let { ResolvedStyleImage(it) }
        } }
    // Прореживание остановок и машин - по масштабу.
    val zoom by remember(mapState) { derivedStateOf { mapState.viewport?.cameraPosition?.zoom ?: initialCamera.zoom } }
    LaunchedEffect(zoom) { stopRate = stopSampleRate(zoom) }
    val vehicleRate = vehicleSampleRate(zoom)
    // Маршрут «откуда - куда» (панель «Маршрут» сайта).
    val journey = remember { JourneyController(scope, repository.walk, repository::schedule) }
    var journeyOpen by remember { mutableStateOf(false) }
    var pickerField by remember { mutableStateOf<JourneyField?>(null) }
    var mapPickField by remember { mutableStateOf<JourneyField?>(null) }
    val walkRoutes = remember { mutableStateMapOf<String, WalkRoute?>() }
    fun setJourneyPoint(field: JourneyField, point: JourneyPoint) = if (field == JourneyField.From) journey.changeFrom(point) else journey.changeTo(point)
    val examples = remember(catalog) { catalog?.let(::typingExamples)?.takeIf { it.isNotEmpty() } ?: DEFAULT_TYPING_EXAMPLES }
    val typing = rememberTypingPlaceholder(examples, active = !searchOpen)

    fun flyTo(lat: Double, lng: Double, zoom: Double) = camera.flyTo(lat, lng, zoom)

    fun onSearchPick(pick: SearchPick) {
        scope.launch { historyStore.remember(pick.historyEntry()) }
        searchOpen = false
        following = false
        // Результат поиска - поверх всего остального: приветствие и настройки закрываем.
        info = null
        settingsOpen = false
        when (pick) {
            is SearchPick.StopPick -> { selection = MapSelection.Stop(pick.stop.id); flyTo(pick.stop.lat, pick.stop.lng, 16.0) }
            is SearchPick.RoutePick -> pick.route.directions.firstOrNull()?.let { selection = MapSelection.Route(pick.route.id, it.subrouteId) }
            is SearchPick.StationPick -> { selection = MapSelection.Station(pick.station.id); flyTo(pick.station.lat, pick.station.lng, 15.0) }
            is SearchPick.DepotPick -> {
                selection = null
                val ring = pick.depot.polygons.first()
                flyTo(ring.map { it[0] }.average(), ring.map { it[1] }.average(), 16.0)
            }
        }
    }

    LaunchedEffect(tracking) {
        if (!tracking) return@LaunchedEffect
        var first = true
        runCatching {
            locationUpdates().collect { point ->
                userLocation = point
                // С первым ответом карта перелетает к пользователю, дальше метка просто едет.
                if (first) { first = false; camera.flyToZoom(point, maxOf(camera.zoom, 15.0)) }
            }
        }.onFailure { tracking = false; locationDenied = true }
    }

    fun onLocate() {
        val u = userLocation
        when {
            tracking && u != null -> flyTo(u.lat, u.lng, maxOf(camera.zoom, 15.0))
            hasLocationPermission() -> tracking = true
            else -> requestLocation()
        }
    }

    fun onNearby() {
        if (selection == MapSelection.Nearby) { selection = null; return }
        following = false
        if (!hasLocationPermission() && !locationDenied) { pendingNearby = true; requestLocation(); return }
        if (hasLocationPermission()) tracking = true
        selection = MapSelection.Nearby
    }

    // «Назад»: закрыть поиск, затем карточку или настройки - как крестики.
    BackHandler(enabled = searchOpen || selection != null || settingsOpen || favoritesOpen || info != null || journeyOpen || pickerField != null || mapPickField != null) {
        when {
            pickerField != null -> pickerField = null
            mapPickField != null -> mapPickField = null
            searchOpen -> searchOpen = false
            info != null -> info = null
            settingsOpen -> settingsOpen = false
            selection != null -> { selection = null; following = false }
            journeyOpen -> { journeyOpen = false }
            else -> favoritesOpen = false
        }
    }
    val colors = AppTheme.colors
    val lifecycle = LocalLifecycleOwner.current.lifecycle

    LaunchedEffect(Unit) {
        if (initialPreferences.startView == StartView.Location && hasLocationPermission()) tracking = true
    }
    // Карта остановилась - запомнить место (стартовая точка «где остановились»); карту потянули
    // пальцем - перестаём водить камеру за машиной (иначе они спорят).
    LaunchedEffect(mapState) {
        mapState.events.collect { event ->
            when (event) {
                MapEvent.Idle -> {
                    val c = mapState.cameraPosition
                    preferencesStore.saveLastView(LastView(c.target.latitude, c.target.longitude, c.zoom))
                }
                is MapEvent.CameraMoveStarted -> if (mapState.cameraMoveReason == org.maplibre.compose.camera.CameraMoveReason.GESTURE) following = false
                else -> Unit
            }
        }
    }
    // Нажатие по остановке или вокзалу (слои) и по пустому месту карты.
    mapClick = { s -> selection = s; following = false; if (s != null) { settingsOpen = false; info = null } }
    LaunchedEffect(catalog) { vehicleLayer.lineOf = lineCache(catalog) }
    LaunchedEffect(preferences.reduceMotion) { vehicleLayer.animate = !preferences.reduceMotion }

    LaunchedEffect(catalog) { journey.setCatalog(catalog) }
    LaunchedEffect(preferences.maxTransfers) { journey.changeMaxTransfers(preferences.maxTransfers) }

    // «Указать на карте»: следующее нажатие по карте - точка; подпись - ближайший адрес.
    fun pickPoint(point: LatLngPoint) {
        val field = mapPickField ?: return
        mapPickField = null
        setJourneyPoint(field, JourneyPoint.PlacePoint(point, "Точка на карте"))
        scope.launch {
            repository.runCatching { reverseGeocode(point) }.getOrNull()?.let { title ->
                setJourneyPoint(field, JourneyPoint.PlacePoint(point, title))
            }
        }
    }
    // «Моё местоположение»: ждём первое положение и ставим его точкой.
    LaunchedEffect(locationPickField, userLocation) {
        val field = locationPickField ?: return@LaunchedEffect
        val here = userLocation ?: return@LaunchedEffect
        locationPickField = null
        // Не в Краснодаре - строить маршрут отсюда нечем.
        if (insideCity(here)) setJourneyPoint(field, JourneyPoint.PlacePoint(here, "Моё местоположение"))
        else journeyNote = FAR_NOTE
    }

    // Линии выбранного варианта на карте; пешие отрезки - по улицам, когда OSRM ответит.
    val shownJourney = if (journeyOpen) journey.journeys.getOrNull(journey.selected) else null
    val journeyPointOf: (Long) -> LatLngPoint? = { id -> journey.pointOf(id)?.let { LatLngPoint(it.lat, it.lng) } }
    LaunchedEffect(shownJourney) {
        shownJourney ?: return@LaunchedEffect
        for ((a, b) in walkPairs(shownJourney, journeyPointOf)) {
            val key = walkKey(a, b)
            if (key !in walkRoutes) walkRoutes[key] = repository.walk.route(a, b)
        }
    }
    LaunchedEffect(shownJourney, walkRoutes.size, dark) {
        journeyShown = shownJourney?.let {
            journeyLines(it, catalog, journeyPointOf, walkRoutes, { t -> when (t) { TransportType.Bus -> colors.bus; TransportType.Troll -> colors.troll; TransportType.Tram -> colors.tram }.toArgb() }, colors.walk.toArgb())
        }
    }
    // Ссылка «Поделиться» (MapDeepLink сайта): ?stop=, ?vehicle=, ?from=&to= (с fromName/toName).
    // Ждём справочник (и машины для ?vehicle=), потом открываем объект поверх всего.
    LaunchedEffect(link, catalog, vehicles) {
        val uri = link?.let { runCatching { Url(it) }.getOrNull() } ?: return@LaunchedEffect
        val c = catalog ?: return@LaunchedEffect
        fun point(value: String?, name: String?): JourneyPoint? {
            value ?: return null
            value.toLongOrNull()?.let { id -> c.stopsById[id]?.let { return JourneyPoint.StopPoint(id, it.name) } }
            val parts = value.split(',').mapNotNull { it.trim().toDoubleOrNull() }
            return if (parts.size == 2) JourneyPoint.PlacePoint(LatLngPoint(parts[0], parts[1]), name ?: "Точка на карте") else null
        }
        val stopId = uri.parameters.get("stop")?.toLongOrNull()
        val vehicleId = uri.parameters.get("vehicle")
        val from = point(uri.parameters.get("from"), uri.parameters.get("fromName"))
        val to = point(uri.parameters.get("to"), uri.parameters.get("toName"))
        // Машины ещё не пришли - ждём следующего обновления.
        if (vehicleId != null && vehicles.isEmpty()) return@LaunchedEffect
        info = null
        settingsOpen = false
        searchOpen = false
        when {
            from != null || to != null -> {
                journey.setBoth(from, to)
                selection = null
                journeyOpen = true
            }
            stopId != null -> c.stopsById[stopId]?.let { stop ->
                selection = MapSelection.Stop(stop.id)
                flyTo(stop.lat, stop.lng, 16.0)
            }
            vehicleId != null -> vehicles.firstOrNull { it.deviceCode == vehicleId }?.let { v ->
                // Машина закончила смену - просто карта.
                selection = MapSelection.Vehicle(v.deviceCode)
                flyTo(v.lat, v.lng, 16.0)
            }
        }
        onLinkHandled()
    }

    // Навигатор: карта крупно показывает текущий шаг (на последнем - точку B).
    LaunchedEffect(journey.navStep, shownJourney) {
        val j = shownJourney ?: return@LaunchedEffect
        val step = journey.navStep ?: return@LaunchedEffect
        val index = ru.khudob1n.krasnodar.transport.ui.journey.navigationSteps(j).getOrNull(step)
        if (index == null) {
            j.legs.lastOrNull()?.leg?.to?.let(journeyPointOf)?.let { flyTo(it.lat, it.lng, 16.0) }
            return@LaunchedEffect
        }
        val leg = j.legs[index].leg
        val pts = listOfNotNull(journeyPointOf(leg.from), journeyPointOf(leg.to))
        camera.fit(pts)
    }
    // Новый результат - камера показывает вариант целиком над панелью.
    LaunchedEffect(shownJourney?.itinerary) {
        val j = shownJourney ?: return@LaunchedEffect
        val pts = j.legs.flatMap { listOfNotNull(journeyPointOf(it.leg.from), journeyPointOf(it.leg.to)) }
        // Сверху - поиск и плашки (~140 dp), снизу - панель «Маршрут» (62 % экрана), по бокам - колонки кнопок.
        camera.fit(pts)
    }

    // Машины - раз в 5 секунд, пока карта на экране (сайт опрашивает так же).
    LaunchedEffect(preferences.reduceMotion) {
        val interval = if (preferences.reduceMotion) VEHICLES_REFRESH_REDUCED_MS else VEHICLES_REFRESH_MS
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (true) {
                runCatching { repository.vehicles() }.onSuccess { vehicles = it }
                delay(interval)
            }
        }
    }

    val selectedRoute = selection as? MapSelection.Route
    val routeStops = selectedRoute?.let { catalog?.routeStopsById?.get(it.routeId) }
    val routeDirection = routeStops?.directions?.firstOrNull { it.subrouteId == selectedRoute.subrouteId }
    // Какие машины на карте: открыт маршрут - его направление; построен маршрут «откуда - куда» -
    // только машины его поездок, в навигаторе - текущей (на пешем шаге - следующей) поездки.
    val journeyVehicles: Set<Pair<Long, Long>>? = run {
        val j = if (journeyOpen && selection == null) journey.journeys.getOrNull(journey.selected) else null
        j ?: return@run null
        val steps = j.legs.filterIsInstance<ru.khudob1n.krasnodar.transport.domain.PlannedLeg.RideStep>()
        val step = journey.navStep?.let { ru.khudob1n.krasnodar.transport.ui.journey.navigationSteps(j).getOrNull(it) }
        val rides = when {
            journey.navStep == null -> steps
            step == null -> emptyList() // «Вы на месте»
            else -> listOfNotNull(j.legs.drop(step).firstOrNull { it is ru.khudob1n.krasnodar.transport.domain.PlannedLeg.RideStep } as? ru.khudob1n.krasnodar.transport.domain.PlannedLeg.RideStep)
        }
        rides.flatMap { r -> r.leg.alternatives.map { it.pattern.routeId to it.pattern.subrouteId } + (r.chosen.routeId to r.chosen.subrouteId) }.toSet()
    }
    val vehicleFilter = selectedRoute?.let { setOf(it.routeId to it.subrouteId) } ?: journeyVehicles
    LaunchedEffect(vehicles, catalog, preferences, vehicleFilter, vehicleRate) {
        vehicleLayer.setMarks(vehicleMarks(vehicles, catalog, preferences, vehicleFilter, vehicleRate))
    }
    // Маршрут открыт - камера показывает его целиком (над карточкой), как flyTo на сайте.
    LaunchedEffect(selectedRoute) {
        val points = selectedRoute?.let { catalog?.geometryBySubroute?.get(it.subrouteId)?.points } ?: return@LaunchedEffect
        camera.fit(points, side = 24.dp, top = 80.dp, bottomExtra = 16.dp)
    }

    val selectedVehicle = (selection as? MapSelection.Vehicle)?.let { s -> vehicles.firstOrNull { it.deviceCode == s.deviceCode } }
    val selectedDirection = selectedVehicle?.let { v -> catalog?.routeStopsById?.get(v.routeId)?.directions?.firstOrNull { it.subrouteId == v.subrouteId } }

    // Линия маршрута выбранной машины - её направления, цветом вида транспорта.
    val routeColor = selectedVehicle?.transport?.let { t -> when (t) { TransportType.Bus -> colors.bus; TransportType.Troll -> colors.troll; TransportType.Tram -> colors.tram }.toArgb() } ?: 0
    val lineSubroute = selectedDirection?.subrouteId ?: routeDirection?.subrouteId
    val lineColor = if (routeStops != null) routeStops.transport?.let { t -> when (t) { TransportType.Bus -> colors.bus; TransportType.Troll -> colors.troll; TransportType.Tram -> colors.tram }.toArgb() } ?: 0 else routeColor
    LaunchedEffect(lineSubroute, lineColor, catalog) {
        routeLine = lineSubroute?.let { catalog?.geometryBySubroute?.get(it)?.points }?.let { it to lineColor }
    }
    // «Наблюдать за движением»: камера подъезжает к машине и дальше едет вместе с ней.
    val followed = selectedVehicle?.deviceCode?.takeIf { following }
    LaunchedEffect(followed) {
        vehicleLayer.follow = null
        val id = followed ?: return@LaunchedEffect
        val p = vehicleLayer.position(id) ?: selectedVehicle?.let { LatLngPoint(it.lat, it.lng) } ?: return@LaunchedEffect
        camera.panTo(p) { vehicleLayer.follow = id }
    }

    val wideScreen = screenWidthDp() > 768
    val favoritesState = FavoritesState(favorites) { transform -> scope.launch { favoritesStore.update(transform) } }
    CompositionLocalProvider(LocalMapPreferences provides preferences, LocalFavorites provides favoritesState) {
    Box(modifier.fillMaxSize()) {
        val density = LocalDensity.current.density
        val mapBg = colors.mapBg
        val vehicleScale = preferences.iconSizes.all * preferences.iconSizes.vehicles
        MaplibreMap(
            modifier = Modifier.fillMaxSize(),
            state = mapState,
            cameraConstraints = CameraConstraints(minZoom = 10.0, boundingBox = BoundingBox(west = City.WEST, south = City.SOUTH, east = City.EAST, north = City.NORTH)),
            interactions = MapInteractions {
                camera {
                    rotate { enabled = false }
                    tilt { enabled = false }
                }
                callbacks {
                    click {
                        // Сначала «указать на карте», потом машины (они над остановками), потом слои.
                        onEvent { e ->
                            val pos = e.position
                            when {
                                mapPickField != null && pos != null -> { pickPoint(LatLngPoint(pos.latitude, pos.longitude)); ClickResult.Consume }
                                else -> vehicleLayer.vehicleAt(e.screenOffset.x.value * density, e.screenOffset.y.value * density, density, vehicleScale)
                                    ?.let { mapClick(MapSelection.Vehicle(it)); ClickResult.Consume } ?: ClickResult.Pass
                            }
                        }
                        onUnhandled { mapClick(null); ClickResult.Consume }
                    }
                }
            },
            uiOptions = MapUiOptions { loadColor = mapBg },
            overlay = { vehicleLayer.Canvas(mapState, renderer, dark, vehicleScale, onFollow = camera::jumpTo) },
        )
        MapControls(
            actions = MapControlActions(
                onToggleTheme = onToggleTheme,
                onSearch = { searchOpen = true },
                onSettings = {
                    settingsOpen = !settingsOpen
                    if (settingsOpen) { selection = null; following = false; info = null }
                },
                onInfo = {
                    info = if (info == null) InfoPanel.Welcome else null
                    if (info != null) { selection = null; following = false; settingsOpen = false }
                },
                onLocate = ::onLocate,
                onNearby = ::onNearby,
                onZoomIn = { camera.zoomBy(1.0) },
                onZoomOut = { camera.zoomBy(-1.0) },
                onFavorites = { favoritesOpen = true },
                onJourney = {
                    journeyOpen = !journeyOpen
                    if (journeyOpen) { selection = null; following = false; settingsOpen = false; info = null }
                },
            ),
            searchHint = typing ?: examples.first(),
            nearbyOpened = selection == MapSelection.Nearby,
            settingsOpened = settingsOpen,
            infoOpened = info != null,
            favoritesButton = !favoritesOpen,
            badges = { compact -> MapBadges(repository::traffic, compact) },
        )
        if (searchOpen) {
            SearchScreen(
                catalog = catalog,
                history = history,
                onPick = ::onSearchPick,
                onClose = { searchOpen = false },
                modifier = Modifier.safeDrawingPadding().padding(16.dp),
            )
        }
        info?.let { panel ->
            Sidepage(
                onClose = { info = null },
                modifier = Modifier.align(Alignment.BottomCenter),
                height = 0.88f,
            ) {
                when (panel) {
                    InfoPanel.Welcome -> WelcomeCard()
                    is InfoPanel.ArticlePage -> {
                        val article = articles?.firstOrNull { it.slug == panel.slug }
                        when {
                            article != null -> ArticleCard(article)
                            articlesFailed -> Text("Не удалось загрузить статью. Проверьте интернет.", Modifier.padding(24.dp), style = AppTheme.type.body, color = AppTheme.colors.functional)
                            articles != null -> Text("Статья не найдена", Modifier.padding(24.dp), style = AppTheme.type.body, color = AppTheme.colors.functional)
                            else -> Text("Загружаем…", Modifier.padding(24.dp), style = AppTheme.type.body, color = AppTheme.colors.functional)
                        }
                    }
                }
            }
        }
        if (journeyOpen && selection == null && !settingsOpen && info == null && mapPickField == null) {
            Sidepage(
                onClose = { journeyOpen = false },
                modifier = Modifier.align(Alignment.BottomCenter),
                height = 0.62f,
            ) {
                JourneyCard(journey, onEditField = { pickerField = it }, note = journeyNote ?: if (locationPickField != null) "Определяем, где вы…" else null)
            }
        }
        mapPickField?.let { field ->
            // Подсказка вместо панели, пока выбирают точку на карте.
            Sidepage(onClose = { mapPickField = null }, modifier = Modifier.align(Alignment.BottomCenter)) {
                Text(
                    "Нажмите на карту — там будет «${if (field == JourneyField.From) "Откуда" else "Куда"}»",
                    Modifier.padding(start = 16.dp, end = 64.dp, top = 4.dp, bottom = 20.dp),
                    style = AppTheme.type.body, color = AppTheme.colors.textPrimary,
                )
            }
        }
        pickerField?.let { field ->
            Box(Modifier.fillMaxSize().background(AppTheme.colors.backgroundPrimary.copy(alpha = 0.6f))) {
                JourneyPicker(
                    field = field,
                    catalog = catalog,
                    geocode = repository::geocode,
                    directionNote = { id -> nextStopName(catalog, id)?.let { "→ $it" } },
                    onPick = { pick ->
                        pickerField = null
                        journeyNote = null
                        when (pick) {
                            is JourneyPick.Point -> setJourneyPoint(field, pick.point)
                            JourneyPick.OnMap -> mapPickField = field
                            JourneyPick.MyLocation -> {
                                val here = userLocation
                                when {
                                    here != null && insideCity(here) -> setJourneyPoint(field, JourneyPoint.PlacePoint(here, "Моё местоположение"))
                                    here != null -> journeyNote = FAR_NOTE
                                    locationDenied -> journeyNote = DENIED_NOTE
                                    hasLocationPermission() -> { tracking = true; locationPickField = field }
                                    else -> { locationPickField = field; requestLocation() }
                                }
                            }
                        }
                    },
                    onClose = { pickerField = null },
                    modifier = Modifier.safeDrawingPadding().padding(16.dp),
                )
            }
        }
        // Пока открыта карточка или настройки, избранное скрыто - как на сайте.
        if (favoritesOpen && selection == null && !settingsOpen && !searchOpen && info == null && !journeyOpen) {
            FavoritesPanel(
                catalog = catalog,
                loadSchedule = repository::schedule,
                onClose = { favoritesOpen = false },
                onStopClick = { stop -> selection = MapSelection.Stop(stop.id); flyTo(stop.lat, stop.lng, 16.0) },
                onRouteClick = { route -> route.directions.firstOrNull()?.let { selection = MapSelection.Route(route.id, it.subrouteId) } },
                // На телефоне звёздочка сверху - панель раскрывается оттуда, на планшете - снизу, как на сайте.
                atTop = !wideScreen,
                modifier = Modifier.align(if (wideScreen) Alignment.BottomStart else Alignment.TopStart).safeDrawingPadding().padding(16.dp),
            )
        }
        if (settingsOpen) {
            Sidepage(
                onClose = { settingsOpen = false },
                modifier = Modifier.align(Alignment.BottomCenter),
                height = 0.88f,
            ) {
                SettingsCard(
                    theme = theme,
                    onThemeChange = onThemeChange,
                    preferences = preferences,
                    onChange = { transform -> scope.launch { preferencesStore.update(transform) } },
                    catalog = catalog,
                    onResetAll = { scope.launch { onResetAll(); historyStore.clear(); preferencesStore.clear(); favoritesStore.clear() } },
                    favoritesTransfer = { FavoritesTransfer() },
                    onOpenArticle = { slug -> settingsOpen = false; info = InfoPanel.ArticlePage(slug) },
                )
            }
        }
        val current = selection
        if (current != null) {
            Sidepage(
                onClose = { selection = null; following = false },
                modifier = Modifier.align(Alignment.BottomCenter),
                height = 0.62f,
            ) {
                when (current) {
                    is MapSelection.Vehicle -> {
                        val v = selectedVehicle
                        val type = v?.transport
                        if (v != null && type != null) {
                            VehicleCard(
                                vehicle = v, type = type, direction = selectedDirection, following = following,
                                onToggleFollow = { following = !following },
                                onStopClick = { station -> selection = MapSelection.Stop(station.id); following = false },
                            )
                        }
                    }
                    is MapSelection.Route -> {
                        val type = routeStops?.transport
                        if (routeStops != null && routeDirection != null && type != null) {
                            RouteCard(
                                route = routeStops, type = type, direction = routeDirection,
                                onSelectDirection = { d -> selection = MapSelection.Route(routeStops.id, d.subrouteId) },
                                onStopClick = { station -> selection = MapSelection.Stop(station.id) },
                                favoriteButton = {
                                    FavoriteButton(favorites.hasRoute(routeStops.id), "маршрут", { favoritesState.update { it.toggleRoute(routeStops.id) } })
                                },
                            )
                        }
                    }
                    MapSelection.Nearby -> {
                        val c = catalog
                        if (c != null) {
                            val center = camera.target
                            val origin = userLocation ?: if (!tracking || locationDenied) center else null
                            NearbyCard(
                                catalog = c, origin = origin, fromMapCenter = userLocation == null && origin != null,
                                loadSchedule = repository::schedule,
                                onStopClick = { stop -> selection = MapSelection.Stop(stop.id); flyTo(stop.lat, stop.lng, 16.0) },
                            )
                        }
                    }
                    is MapSelection.Station -> {
                        val station = catalog?.railStations?.firstOrNull { it.id == current.id }
                        if (station != null) {
                            StationCard(station) { date, event -> repository.railSchedule(station, date, event) }
                        }
                    }
                    is MapSelection.Stop -> {
                        val stop = catalog?.stopsById?.get(current.id)
                        if (stop != null) {
                            StopCard(stop, stopKindOf(catalog?.stopTypes?.get(stop.id)), repository::schedule, onJourney = { fromHere ->
                                val point = JourneyPoint.StopPoint(stop.id, stop.name)
                                // Та же остановка уже на другом конце - это «поменять местами».
                                val other = if (fromHere) journey.to else journey.from
                                val otherIsSame = (other as? JourneyPoint.StopPoint)?.id == stop.id
                                if (fromHere) journey.setBoth(point, if (otherIsSame) journey.from else journey.to)
                                else journey.setBoth(if (otherIsSame) journey.to else journey.from, point)
                                selection = null
                                journeyOpen = true
                            })
                        }
                    }
                }
            }
        }
    }
}
}

/** Линии маршрутов для движения машин - строятся по запросу и живут, пока справочник тот же. */
private fun lineCache(catalog: ru.khudob1n.krasnodar.transport.data.Catalog?): (Long) -> RouteLine? {
    val lines = HashMap<Long, RouteLine?>()
    return { id -> lines.getOrPut(id) { catalog?.geometryBySubroute?.get(id)?.points?.takeIf { it.size >= 2 }?.let(::RouteLine) } }
}
