package ru.khudob1n.krasnodar.transport.ui.settings

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import kotlinx.coroutines.launch
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.unit.dp
import org.maplibre.compose.camera.CameraPosition
import org.maplibre.compose.interaction.MapInteractions
import org.maplibre.compose.map.MaplibreMap
import org.maplibre.compose.map.MapUiOptions
import org.maplibre.compose.map.ResolvedStyleImage
import org.maplibre.compose.map.rememberMapState
import org.maplibre.compose.style.BaseStyle
import org.maplibre.spatialk.geojson.Position
import ru.khudob1n.krasnodar.transport.data.Catalog
import ru.khudob1n.krasnodar.transport.data.LatLngPoint
import ru.khudob1n.krasnodar.transport.data.Vehicle
import ru.khudob1n.krasnodar.transport.map.TransportLayers
import ru.khudob1n.krasnodar.transport.map.VehicleLayer
import ru.khudob1n.krasnodar.transport.map.imageFor
import ru.khudob1n.krasnodar.transport.map.mapStyleJson
import ru.khudob1n.krasnodar.transport.map.rememberMarkerRenderer
import ru.khudob1n.krasnodar.transport.map.vehicleMarks
import ru.khudob1n.krasnodar.transport.settings.MapPreferences
import ru.khudob1n.krasnodar.transport.ui.components.TransportType
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme
import kotlin.time.Clock

private val PREVIEW_CENTER = LatLngPoint(45.0193, 38.9874)
// 15 у MapLibre (тайлы 512) - тот же кадр, что 16 у Leaflet на сайте (тайлы 256).
private const val PREVIEW_ZOOM = 15.0

// Машины стоят на месте и не зависят от живых данных: в кадре всегда все виды транспорта.
private data class PreviewVehicle(val type: TransportType, val routeType: String, val number: String, val lat: Double, val lng: Double, val course: Double, val lowFloor: Boolean)

private val PREVIEW_VEHICLES = listOf(
    PreviewVehicle(TransportType.Bus, "А", "2Е", 45.01881, 38.9862, 102.0, lowFloor = true),
    PreviewVehicle(TransportType.Troll, "Тб", "7", 45.01937, 38.9847, 330.0, lowFloor = false),
    PreviewVehicle(TransportType.Tram, "Тм", "15", 45.02069, 38.98948, 161.0, lowFloor = false),
)

/**
 * Мини-карта в настройках: та же подложка и те же слои, что на основной карте, с текущими
 * настройками; сама не двигается и не нажимается.
 */
@Composable
fun MapPreview(preferences: MapPreferences, catalog: Catalog?) {
    val dark = AppTheme.colors.isDark
    val renderer = rememberMarkerRenderer()
    val vehicles = remember { VehicleLayer().also { it.animate = false } }
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    var labelsVersion by remember { androidx.compose.runtime.mutableStateOf(0) }
    val mapState = rememberMapState(
        baseStyle = BaseStyle.Json(remember(dark, preferences.basemap) { mapStyleJson(dark, preferences.basemap) }),
        initialCameraPosition = CameraPosition(target = Position(longitude = PREVIEW_CENTER.lng, latitude = PREVIEW_CENTER.lat), zoom = PREVIEW_ZOOM),
    ) {
        TransportLayers(catalog, preferences, dark, stopRate = 1, route = null, journey = null, user = null, renderer = renderer, labelsVersion = labelsVersion, onSelect = {})
    }
    LaunchedEffect(mapState, renderer) { mapState.missingImageResolver = { id ->
            renderer.imageFor(id).also { scope.launch { kotlinx.coroutines.delay(250); labelsVersion++ } }?.let { ResolvedStyleImage(it) }
        } }
    LaunchedEffect(catalog, preferences) {
        // Маршрут и направление - настоящие, иначе у машины был бы значок «не по маршруту».
        val now = Clock.System.now().toString()
        val list = PREVIEW_VEHICLES.map { v ->
            val route = catalog?.routeStops?.firstOrNull { it.transport == v.type && it.number == v.number }
            Vehicle(
                deviceCode = "preview-${v.type.name}", routeId = route?.id ?: 0, subrouteId = route?.directions?.firstOrNull()?.subrouteId ?: 0,
                routeType = v.routeType, routeNumber = v.number, lat = v.lat, lng = v.lng, dir = v.course, navTime = now, lowFloor = v.lowFloor,
            )
        }
        vehicles.setMarks(vehicleMarks(list, catalog, preferences, filter = null, rate = 1))
    }
    val scale = preferences.iconSizes.all * preferences.iconSizes.vehicles
    val loadColor = AppTheme.colors.mapBg
    MaplibreMap(
        modifier = Modifier.fillMaxWidth().height(240.dp).clip(RoundedCornerShape(12.dp))
            .border(1.dp, AppTheme.colors.backgroundSecondary, RoundedCornerShape(12.dp))
            // Превью только для взгляда: TalkBack и VoiceOver читают одну подпись.
            .clearAndSetSemantics { contentDescription = "Предпросмотр карты с текущими настройками" },
        state = mapState,
        interactions = MapInteractions.None,
        uiOptions = MapUiOptions { this.loadColor = loadColor },
        overlay = { vehicles.Canvas(mapState, renderer, dark, scale, onFollow = {}) },
    )
}
