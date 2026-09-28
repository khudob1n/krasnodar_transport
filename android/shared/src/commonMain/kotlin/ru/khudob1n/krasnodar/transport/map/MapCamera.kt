package ru.khudob1n.krasnodar.transport.map

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import org.maplibre.compose.camera.CameraAnimation
import org.maplibre.compose.camera.CameraUpdate
import org.maplibre.compose.map.MapState
import org.maplibre.compose.util.DpPadding
import org.maplibre.spatialk.geojson.BoundingBox
import org.maplibre.spatialk.geojson.Position
import ru.khudob1n.krasnodar.transport.data.LatLngPoint
import kotlin.time.Duration.Companion.milliseconds

/** Доля экрана снизу, которую занимает карточка (Sidepage 62 %). */
const val CARD_FRACTION = 0.62f

/** Движения камеры, которые нужны экрану карты (flyTo, fitBounds сайта). */
class MapCamera(private val state: MapState, private val scope: CoroutineScope) {
    private val height: Dp get() = state.viewport?.size?.height ?: 800.dp

    val zoom: Double get() = state.cameraPosition.zoom

    val target: LatLngPoint get() = state.cameraPosition.target.let { LatLngPoint(it.latitude, it.longitude) }

    /** Объект - над карточкой, которая сейчас откроется (62 % высоты снизу), а не под ней (flyToVisible сайта). */
    fun flyTo(lat: Double, lng: Double, zoom: Double) {
        scope.launch {
            runCatching {
                state.animateCamera(
                    CameraUpdate(target = Position(longitude = lng, latitude = lat), zoom = zoom, padding = DpPadding(bottom = height * CARD_FRACTION)),
                    CameraAnimation.Ease(700.milliseconds),
                )
            }
        }
    }

    /** Показать точки целиком: сверху - поиск и плашки, снизу - карточка, по бокам - колонки кнопок. */
    fun fit(points: List<LatLngPoint>, side: Dp = 72.dp, top: Dp = 140.dp, bottomExtra: Dp = 24.dp) {
        if (points.size < 2) return
        val box = BoundingBox(
            west = points.minOf { it.lng }, south = points.minOf { it.lat },
            east = points.maxOf { it.lng }, north = points.maxOf { it.lat },
        )
        scope.launch {
            runCatching {
                state.animateCameraToBounds(
                    box,
                    cameraPadding = DpPadding.Zero,
                    fitPadding = DpPadding(left = side, top = top, right = side, bottom = height * CARD_FRACTION + bottomExtra),
                    animation = CameraAnimation.Ease(700.milliseconds),
                )
            }
        }
    }

    fun zoomBy(delta: Double) {
        scope.launch { runCatching { state.animateCamera(CameraUpdate(zoom = zoom + delta), CameraAnimation.Ease(300.milliseconds)) } }
    }

    /** Подлететь к точке, не меняя масштаб, и потом [then]. */
    fun panTo(point: LatLngPoint, then: () -> Unit = {}) {
        scope.launch {
            runCatching { state.animateCamera(CameraUpdate(target = Position(longitude = point.lng, latitude = point.lat)), CameraAnimation.Ease(800.milliseconds)) }
            then()
        }
    }

    /** Сразу, без анимации - каждый кадр за машиной. */
    fun jumpTo(point: LatLngPoint) {
        state.setCameraPosition(state.cameraPosition.copy(target = Position(longitude = point.lng, latitude = point.lat)))
    }

    fun flyToZoom(point: LatLngPoint, zoom: Double) {
        scope.launch { runCatching { state.animateCamera(CameraUpdate(target = Position(longitude = point.lng, latitude = point.lat), zoom = zoom), CameraAnimation.Ease(700.milliseconds)) } }
    }
}
