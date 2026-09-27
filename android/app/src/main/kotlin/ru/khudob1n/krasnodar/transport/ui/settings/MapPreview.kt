package ru.khudob1n.krasnodar.transport.ui.settings

import android.os.Bundle
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import ru.khudob1n.krasnodar.transport.data.Catalog
import ru.khudob1n.krasnodar.transport.data.Vehicle
import ru.khudob1n.krasnodar.transport.map.MapLayers
import ru.khudob1n.krasnodar.transport.map.MapViewLifecycle
import ru.khudob1n.krasnodar.transport.map.MarkerRenderer
import ru.khudob1n.krasnodar.transport.map.createMapView
import ru.khudob1n.krasnodar.transport.map.styleUri
import androidx.compose.ui.graphics.toArgb
import ru.khudob1n.krasnodar.transport.settings.MapPreferences
import ru.khudob1n.krasnodar.transport.ui.components.TransportType
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme
import java.time.Instant

// Кадр предпросмотра (MapSettingsPreview сайта) - Привокзальная площадь: вокзал Краснодар-1,
// автовокзал, конечные трамваев и троллейбусов. Одно место, один масштаб.
private val PREVIEW_CENTER = LatLng(45.0193, 38.9874)
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
    val context = LocalContext.current
    val dark = AppTheme.colors.isDark
    val mapBackground = AppTheme.colors.mapBg.toArgb()
    val mapView = remember { createMapView(context, mapBackground, texture = true) }
    var layers by remember { mutableStateOf<MapLayers?>(null) }
    MapViewLifecycle(mapView)

    LaunchedEffect(mapView) {
        mapView.getMapAsync { m ->
            m.cameraPosition = CameraPosition.Builder().target(PREVIEW_CENTER).zoom(PREVIEW_ZOOM).build()
            m.uiSettings.setAllGesturesEnabled(false)
            m.uiSettings.isLogoEnabled = false
            m.uiSettings.isAttributionEnabled = false
            // MapLibre сам ставит себе описание при инициализации - превью только для взгляда.
            mapView.importantForAccessibility = android.view.View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
            mapView.contentDescription = null
            mapView.isClickable = false
            layers = MapLayers(mapView, m, MarkerRenderer(context))
        }
    }
    LaunchedEffect(layers, dark) {
        val l = layers ?: return@LaunchedEffect
        mapView.getMapAsync { m -> m.setStyle(Style.Builder().fromUri(styleUri(dark))) { style -> l.install(style, dark) } }
    }
    LaunchedEffect(layers, catalog) {
        val l = layers ?: return@LaunchedEffect
        l.setCatalog(catalog)
        l.animationsEnabled = false
        // Маршрут и направление - настоящие, иначе у машины был бы значок «не по маршруту».
        val now = Instant.now().toString()
        l.setVehicles(
            PREVIEW_VEHICLES.map { v ->
                val route = catalog?.routeStops?.firstOrNull { it.transport == v.type && it.number == v.number }
                Vehicle(
                    deviceCode = "preview-${v.type.name}", routeId = route?.id ?: 0, subrouteId = route?.directions?.firstOrNull()?.subrouteId ?: 0,
                    routeType = v.routeType, routeNumber = v.number, lat = v.lat, lng = v.lng, dir = v.course, navTime = now, lowFloor = v.lowFloor,
                )
            },
        )
    }
    LaunchedEffect(layers, preferences) { layers?.preferences = preferences.copy(reduceMotion = true) }

    AndroidView(
        factory = { mapView },
        modifier = Modifier.fillMaxWidth().height(240.dp).clip(RoundedCornerShape(12.dp))
            .border(1.dp, AppTheme.colors.backgroundSecondary, RoundedCornerShape(12.dp))
            .semantics { contentDescription = "Предпросмотр карты с текущими настройками" },
    )
}
