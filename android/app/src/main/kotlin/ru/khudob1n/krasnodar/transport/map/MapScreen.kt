package ru.khudob1n.krasnodar.transport.map

import android.os.Bundle
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.delay
import ru.khudob1n.krasnodar.transport.TransportApplication
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.toArgb
import org.maplibre.android.geometry.LatLng
import ru.khudob1n.krasnodar.transport.data.Vehicle
import ru.khudob1n.krasnodar.transport.ui.cards.RouteCard
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import ru.khudob1n.krasnodar.transport.data.LatLngPoint
import ru.khudob1n.krasnodar.transport.ui.cards.NearbyCard
import androidx.activity.compose.BackHandler
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
import org.maplibre.android.geometry.LatLngBounds
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

/** Стиль подложки из assets - его кладёт туда задача syncWebAssets из стилей сайта. */
internal fun styleUri(dark: Boolean) = "asset://map-style-${if (dark) "dark" else "light"}.json"

/**
 * MapView с цветом фона карты темы, пока не загрузился стиль: иначе MapLibre показывает свой
 * бежевый, и между заставкой и картой мелькает чужой цвет (в тёмной теме - особенно).
 */
internal fun createMapView(context: android.content.Context, background: Int, texture: Boolean = false) =
    MapView(
        context,
        org.maplibre.android.maps.MapLibreMapOptions.createFromAttributes(context)
            .foregroundLoadColor(background)
            // Превью в скруглённых карточках: SurfaceView не обрезается по форме, TextureView - да.
            .textureMode(texture),
    ).apply {
        onCreate(Bundle())
        // Своя подпись вместо английской MapLibre; превью (texture) - только для взгляда, TalkBack их пропускает.
        if (texture) importantForAccessibility = android.view.View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        else contentDescription = "Карта транспорта. Машины и остановки открываются нажатием"
    }

@Composable
fun MapScreen(
    link: android.net.Uri?,
    onLinkHandled: () -> Unit,
    theme: ThemePreference,
    onThemeChange: (ThemePreference) -> Unit,
    onToggleTheme: () -> Unit,
    onResetAll: suspend () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val dark = AppTheme.colors.isDark
    val mapBackground = AppTheme.colors.mapBg.toArgb()
    val mapView = remember { createMapView(context, mapBackground) }
    var map by remember { mutableStateOf<MapLibreMap?>(null) }
    var layers by remember { mutableStateOf<MapLayers?>(null) }
    val repository = remember { (context.applicationContext as TransportApplication).repository }
    val catalog by repository.catalog.collectAsState()
    val preferencesStore = remember { (context.applicationContext as TransportApplication).mapPreferences }
    // Настройки и последнее место читаем до первого кадра: от них зависит, где открыть карту.
    val initialPreferences = remember { runBlocking { preferencesStore.preferences.first() } }
    val initialLastView = remember { runBlocking { preferencesStore.lastView() } }
    val preferences by preferencesStore.preferences.collectAsState(initial = initialPreferences)
    var settingsOpen by remember { mutableStateOf(false) }
    val favoritesStore = remember { (context.applicationContext as TransportApplication).favorites }
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
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
        if (granted.values.any { it }) tracking = true else { locationDenied = true; if (locationPickField != null) { locationPickField = null; journeyNote = DENIED_NOTE } }
        if (pendingNearby) { selection = MapSelection.Nearby; pendingNearby = false }
    }
    val historyStore = remember { SearchHistoryStore(context.applicationContext) }
    val history by historyStore.entries.collectAsState(initial = emptyList())
    val scope = rememberCoroutineScope()
    // Маршрут «откуда - куда» (панель «Маршрут» сайта).
    val journey = remember { JourneyController(scope, repository.walk, repository::schedule) }
    var journeyOpen by remember { mutableStateOf(false) }
    var pickerField by remember { mutableStateOf<JourneyField?>(null) }
    var mapPickField by remember { mutableStateOf<JourneyField?>(null) }
    val walkRoutes = remember { mutableStateMapOf<String, WalkRoute?>() }
    fun setJourneyPoint(field: JourneyField, point: JourneyPoint) = if (field == JourneyField.From) journey.changeFrom(point) else journey.changeTo(point)
    val examples = remember(catalog) { catalog?.let(::typingExamples)?.takeIf { it.isNotEmpty() } ?: DEFAULT_TYPING_EXAMPLES }
    val typing = rememberTypingPlaceholder(examples, active = !searchOpen)

    fun flyTo(lat: Double, lng: Double, zoom: Double) {
        // Объект - над карточкой, которая сейчас откроется (62 % высоты снизу), а не под ней
        // (flyToVisible сайта).
        val bottom = mapView.height * 0.62
        map?.animateCamera(
            CameraUpdateFactory.newCameraPosition(
                CameraPosition.Builder().target(LatLng(lat, lng)).zoom(zoom).padding(0.0, 0.0, 0.0, bottom).build(),
            ),
            700,
        )
    }

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
            locationUpdates(context).collect { loc ->
                val point = LatLngPoint(loc.latitude, loc.longitude)
                userLocation = point
                layers?.setUser(point)
                // С первым ответом карта перелетает к пользователю, дальше метка просто едет.
                if (first) { first = false; map?.let { m -> m.animateCamera(CameraUpdateFactory.newLatLngZoom(LatLng(point.lat, point.lng), maxOf(m.cameraPosition.zoom, 15.0)), 700) } }
            }
        }.onFailure { tracking = false; locationDenied = true }
    }

    fun onLocate() {
        val u = userLocation
        when {
            tracking && u != null -> flyTo(u.lat, u.lng, maxOf(map?.cameraPosition?.zoom ?: 15.0, 15.0))
            hasLocationPermission(context) -> tracking = true
            else -> permissionLauncher.launch(LOCATION_PERMISSIONS)
        }
    }

    fun onNearby() {
        if (selection == MapSelection.Nearby) { selection = null; return }
        following = false
        if (!hasLocationPermission(context) && !locationDenied) { pendingNearby = true; permissionLauncher.launch(LOCATION_PERMISSIONS); return }
        if (hasLocationPermission(context)) tracking = true
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

    MapViewLifecycle(mapView)

    LaunchedEffect(mapView) {
        mapView.getMapAsync { m ->
            m.setLatLngBoundsForCameraTarget(City.bounds)
            m.setMinZoomPreference(10.0)
            // «Где открывать карту»: центр, последнее место или «где я» (метка появится с первым ответом).
            val last = initialLastView.takeIf { initialPreferences.startView == StartView.Last }
            m.cameraPosition = CameraPosition.Builder()
                .target(last?.let { LatLng(it.lat, it.lng) } ?: City.center)
                .zoom(last?.zoom ?: City.DEFAULT_ZOOM)
                .build()
            if (initialPreferences.startView == StartView.Location && hasLocationPermission(context)) tracking = true
            m.addOnCameraIdleListener {
                val c = m.cameraPosition
                val target = c.target ?: return@addOnCameraIdleListener
                scope.launch { preferencesStore.saveLastView(LastView(target.latitude, target.longitude, c.zoom)) }
            }
            // Карту потянули пальцем - перестаём водить камеру за машиной (иначе они спорят).
            m.addOnCameraMoveStartedListener { reason ->
                if (reason == MapLibreMap.OnCameraMoveStartedListener.REASON_API_GESTURE) following = false
            }
            m.uiSettings.isRotateGesturesEnabled = false
            m.uiSettings.isTiltGesturesEnabled = false
            // Своя атрибуция и логотип - в «Откуда данные»; кнопка MapLibre мешала бы избранному.
            m.uiSettings.isLogoEnabled = false
            m.uiSettings.isAttributionEnabled = false
            layers = MapLayers(mapView, m, MarkerRenderer(context)).also {
                it.onSelect = { s -> selection = s; following = false; if (s != null) { settingsOpen = false; info = null } }
                it.preferences = initialPreferences
            }
            map = m
        }
    }

    // Тема сменилась - меняем стиль у уже созданной карты, как сайт (setStyle); слои остановок
    // и машин живут в стиле, поэтому ставятся заново.
    LaunchedEffect(map, dark) {
        val m = map ?: return@LaunchedEffect
        m.setStyle(Style.Builder().fromUri(styleUri(dark))) { style -> layers?.install(style, dark) }
    }

    LaunchedEffect(layers, catalog) { layers?.setCatalog(catalog) }
    LaunchedEffect(layers, preferences) { layers?.preferences = preferences }
    LaunchedEffect(catalog) { journey.setCatalog(catalog) }
    LaunchedEffect(preferences.maxTransfers) { journey.changeMaxTransfers(preferences.maxTransfers) }

    // «Указать на карте»: следующее нажатие по карте - точка; подпись - ближайший адрес.
    LaunchedEffect(layers, mapPickField) {
        val l = layers ?: return@LaunchedEffect
        val field = mapPickField
        l.onPickPoint = if (field == null) null else { point ->
            mapPickField = null
            setJourneyPoint(field, JourneyPoint.PlacePoint(point, "Точка на карте"))
            scope.launch {
                repository.runCatching { reverseGeocode(point) }.getOrNull()?.let { title ->
                    setJourneyPoint(field, JourneyPoint.PlacePoint(point, title))
                }
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
    LaunchedEffect(layers, shownJourney, walkRoutes.size, dark) {
        layers?.setJourney(shownJourney?.let {
            journeyLines(it, catalog, journeyPointOf, walkRoutes, { t -> when (t) { TransportType.Bus -> colors.bus; TransportType.Troll -> colors.troll; TransportType.Tram -> colors.tram }.toArgb() }, colors.walk.toArgb())
        })
    }
    // Ссылка «Поделиться» (MapDeepLink сайта): ?stop=, ?vehicle=, ?from=&to= (с fromName/toName).
    // Ждём справочник (и машины для ?vehicle=), потом открываем объект поверх всего.
    LaunchedEffect(link, catalog, vehicles) {
        val uri = link ?: return@LaunchedEffect
        val c = catalog ?: return@LaunchedEffect
        fun point(value: String?, name: String?): JourneyPoint? {
            value ?: return null
            value.toLongOrNull()?.let { id -> c.stopsById[id]?.let { return JourneyPoint.StopPoint(id, it.name) } }
            val parts = value.split(',').mapNotNull { it.trim().toDoubleOrNull() }
            return if (parts.size == 2) JourneyPoint.PlacePoint(LatLngPoint(parts[0], parts[1]), name ?: "Точка на карте") else null
        }
        val stopId = uri.getQueryParameter("stop")?.toLongOrNull()
        val vehicleId = uri.getQueryParameter("vehicle")
        val from = point(uri.getQueryParameter("from"), uri.getQueryParameter("fromName"))
        val to = point(uri.getQueryParameter("to"), uri.getQueryParameter("toName"))
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
        val d = mapView.resources.displayMetrics.density
        if (index == null) {
            j.legs.lastOrNull()?.leg?.to?.let(journeyPointOf)?.let { flyTo(it.lat, it.lng, 16.0) }
            return@LaunchedEffect
        }
        val leg = j.legs[index].leg
        val pts = listOfNotNull(journeyPointOf(leg.from), journeyPointOf(leg.to))
        if (pts.size < 2) return@LaunchedEffect
        val bounds = LatLngBounds.Builder().includes(pts.map { LatLng(it.lat, it.lng) }).build()
        map?.animateCamera(CameraUpdateFactory.newLatLngBounds(bounds, (72 * d).toInt(), (140 * d).toInt(), (72 * d).toInt(), (mapView.height * 0.62).toInt() + (24 * d).toInt()), 700)
    }
    // Новый результат - камера показывает вариант целиком над панелью.
    LaunchedEffect(shownJourney?.itinerary) {
        val j = shownJourney ?: return@LaunchedEffect
        val pts = j.legs.flatMap { listOfNotNull(journeyPointOf(it.leg.from), journeyPointOf(it.leg.to)) }
        if (pts.size < 2) return@LaunchedEffect
        val bounds = LatLngBounds.Builder().includes(pts.map { LatLng(it.lat, it.lng) }).build()
        // Сверху - поиск и плашки (~140 dp), снизу - панель «Маршрут» (62 % экрана), по бокам - колонки кнопок.
        val d = mapView.resources.displayMetrics.density
        map?.animateCamera(CameraUpdateFactory.newLatLngBounds(bounds, (72 * d).toInt(), (140 * d).toInt(), (72 * d).toInt(), (mapView.height * 0.62).toInt() + (24 * d).toInt()), 700)
    }

    // Машины - раз в 5 секунд, пока карта на экране (сайт опрашивает так же).
    LaunchedEffect(layers, preferences.reduceMotion) {
        val l = layers ?: return@LaunchedEffect
        val interval = if (preferences.reduceMotion) VEHICLES_REFRESH_REDUCED_MS else VEHICLES_REFRESH_MS
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (true) {
                runCatching { repository.vehicles() }.onSuccess { vehicles = it; l.setVehicles(it) }
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
    LaunchedEffect(layers, selectedRoute, journeyVehicles) {
        layers?.vehicleFilter = selectedRoute?.let { setOf(it.routeId to it.subrouteId) } ?: journeyVehicles
    }
    // Маршрут открыт - камера показывает его целиком (над карточкой), как flyTo на сайте.
    LaunchedEffect(selectedRoute) {
        val points = selectedRoute?.let { catalog?.geometryBySubroute?.get(it.subrouteId)?.points } ?: return@LaunchedEffect
        if (points.size < 2) return@LaunchedEffect
        val bounds = LatLngBounds.Builder().includes(points.map { LatLng(it.lat, it.lng) }).build()
        val h = mapView.height
        map?.animateCamera(CameraUpdateFactory.newLatLngBounds(bounds, 60, 220, 60, (h * 0.62).toInt() + 40), 700)
    }

    val selectedVehicle = (selection as? MapSelection.Vehicle)?.let { s -> vehicles.firstOrNull { it.deviceCode == s.deviceCode } }
    val selectedDirection = selectedVehicle?.let { v -> catalog?.routeStopsById?.get(v.routeId)?.directions?.firstOrNull { it.subrouteId == v.subrouteId } }

    // Линия маршрута выбранной машины - её направления, цветом вида транспорта.
    val routeColor = selectedVehicle?.transport?.let { t -> when (t) { TransportType.Bus -> colors.bus; TransportType.Troll -> colors.troll; TransportType.Tram -> colors.tram }.toArgb() } ?: 0
    val lineSubroute = selectedDirection?.subrouteId ?: routeDirection?.subrouteId
    val lineColor = if (routeStops != null) routeStops.transport?.let { t -> when (t) { TransportType.Bus -> colors.bus; TransportType.Troll -> colors.troll; TransportType.Tram -> colors.tram }.toArgb() } ?: 0 else routeColor
    LaunchedEffect(layers, lineSubroute, lineColor) {
        val points = lineSubroute?.let { catalog?.geometryBySubroute?.get(it)?.points }
        layers?.setRoute(points, lineColor)
    }
    // «Наблюдать за движением»: камера подъезжает к машине и дальше едет вместе с ней.
    val followed = selectedVehicle?.deviceCode?.takeIf { following }
    LaunchedEffect(layers, followed) {
        val l = layers ?: return@LaunchedEffect
        l.follow(null)
        val id = followed ?: return@LaunchedEffect
        val p = l.displayedPosition(id) ?: selectedVehicle?.let { LatLngPoint(it.lat, it.lng) } ?: return@LaunchedEffect
        map?.animateCamera(CameraUpdateFactory.newLatLng(LatLng(p.lat, p.lng)), 800, object : MapLibreMap.CancelableCallback {
            override fun onFinish() { l.follow(id) }
            override fun onCancel() {}
        })
    }

    val wideScreen = androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp > 768
    val favoritesState = FavoritesState(favorites) { transform -> scope.launch { favoritesStore.update(transform) } }
    CompositionLocalProvider(LocalMapPreferences provides preferences, LocalFavorites provides favoritesState) {
    Box(modifier.fillMaxSize()) {
        AndroidView(factory = { mapView }, modifier = Modifier.fillMaxSize())
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
                onZoomIn = { map?.animateCamera(CameraUpdateFactory.zoomIn()) },
                onZoomOut = { map?.animateCamera(CameraUpdateFactory.zoomOut()) },
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
                                    hasLocationPermission(context) -> { tracking = true; locationPickField = field }
                                    else -> { locationPickField = field; permissionLauncher.launch(LOCATION_PERMISSIONS) }
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
                            val center = map?.cameraPosition?.target
                            val origin = userLocation ?: if (!tracking || locationDenied) center?.let { LatLngPoint(it.latitude, it.longitude) } else null
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

/** MapView требует, чтобы ему пересылали события жизненного цикла экрана. */
@Composable
internal fun MapViewLifecycle(mapView: MapView) {
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    DisposableEffect(lifecycle, mapView) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_START -> mapView.onStart()
                Lifecycle.Event.ON_RESUME -> mapView.onResume()
                Lifecycle.Event.ON_PAUSE -> mapView.onPause()
                Lifecycle.Event.ON_STOP -> mapView.onStop()
                Lifecycle.Event.ON_DESTROY -> mapView.onDestroy()
                else -> Unit
            }
        }
        lifecycle.addObserver(observer)
        onDispose { lifecycle.removeObserver(observer) }
    }
}
