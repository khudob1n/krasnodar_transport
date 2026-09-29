package ru.khudob1n.krasnodar.transport.map

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.drawscope.scale
import kotlinx.coroutines.delay
import org.maplibre.compose.map.MapState
import ru.khudob1n.krasnodar.transport.data.LatLngPoint
import ru.khudob1n.krasnodar.transport.data.Vehicle
import ru.khudob1n.krasnodar.transport.ui.components.TransportType
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.ln
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.tan
import kotlin.time.TimeSource

/** Машина, как её рисовать: stale - координаты устарели, warning - не на линии своего маршрута. */
data class VehicleMark(val vehicle: Vehicle, val type: TransportType, val stale: Boolean, val warning: Boolean)

/** Кадров в секунду, пока машины едут: они ползут медленно, 30 хватает, а батарею бережёт. */
private const val FRAME_MS = 33L

/**
 * Машины поверх карты - как маркеры сайта (Leaflet, по элементу на машину): каждая рисуется
 * целиком - капля, пиктограмма и бейджи, южнее - поверх. В слое MapLibre так не выходит: там
 * порядок держится только внутри тайла, и бейджи одних машин ложились на капли других.
 *
 * Движение плавное, по линии маршрута - см. VehicleMotion. Здесь - кто на карте и где он сейчас;
 * рисует VehicleCanvas.
 */
class VehicleLayer {
    private class Track(var mark: VehicleMark, val motion: VehicleMotion)

    /** Нарисованная в последнем кадре машина - для нажатий. */
    private class Drawn(val id: String, val x: Float, val y: Float, val left: Float, val right: Float)

    private val clock = TimeSource.Monotonic.markNow()
    private fun now() = clock.elapsedNow().inWholeMilliseconds

    private var tracks = LinkedHashMap<String, Track>()
    private var drawn: List<Drawn> = emptyList()

    /** Номер кадра - Canvas читает его и перерисовывается. */
    internal var frame by mutableLongStateOf(0L)
        private set

    /** Линия маршрута по направлению (subrouteId) - по ней машины и едут. */
    var lineOf: (Long) -> RouteLine? = { null }

    /** «Уменьшить движение»: машины переставляются сразу. */
    var animate = true

    /** «Наблюдать за движением»: камера едет вместе с этой машиной. */
    var follow: String? = null

    fun setMarks(marks: List<VehicleMark>) {
        val now = now()
        val next = LinkedHashMap<String, Track>(marks.size)
        for (m in marks) {
            val v = m.vehicle
            val old = tracks[v.deviceCode]
            next[v.deviceCode] = if (old == null) {
                Track(m, VehicleMotion(lineOf(v.subrouteId), v.lat, v.lng, v.dir, now))
            } else {
                old.also { track ->
                    val was = track.mark.vehicle
                    track.mark = m
                    if (was.lat != v.lat || was.lng != v.lng || was.dir != v.dir || was.subrouteId != v.subrouteId) {
                        if (animate) track.motion.fix(v.lat, v.lng, v.dir, now, lineOf(v.subrouteId))
                        else track.motion.jump(v.lat, v.lng, v.dir)
                    }
                }
            }
        }
        tracks = next
        frame++
    }

    /** Сдвинуть машины к текущему моменту; true - кто-то ещё едет. */
    internal fun advance(): Boolean {
        val now = now()
        var moving = false
        for (t in tracks.values) {
            t.motion.advance(now)
            if (t.motion.moving) moving = true
        }
        frame++
        return moving
    }

    /** Где машина нарисована сейчас. */
    fun position(id: String): LatLngPoint? = tracks[id]?.motion?.let { LatLngPoint(it.lat, it.lng) }

    /** Машина под точкой экрана (px; верхняя - южнее), или null. */
    fun vehicleAt(x: Float, y: Float, density: Float, scale: Float): String? {
        val r = 22f * density * scale
        return drawn.lastOrNull { d ->
            hypot(x - d.x, y - d.y) <= r || (x in d.left..d.right && y in d.y - r * 0.8f..d.y + r * 0.8f)
        }?.id
    }

    @Composable
    internal fun Canvas(state: MapState, renderer: MarkerRenderer, dark: Boolean, scale: Float, onFollow: (LatLngPoint) -> Unit) {
        // Кадры, пока машины едут; стоят - раз в полсекунды проверяем, не пришли ли новые.
        LaunchedEffect(this) {
            while (true) {
                var moving = false
                withFrameMillis { moving = advance() }
                follow?.let { id -> position(id)?.let(onFollow) }
                delay(if (moving) FRAME_MS else 500)
            }
        }
        Canvas(Modifier.fillMaxSize()) {
            frame // перерисовка на каждый кадр движения
            val viewport = state.viewport ?: return@Canvas
            val bearing = viewport.cameraPosition.bearing.toFloat()
            // Точки - по камере уже нарисованного кадра карты (viewport), а не по камере, которая
            // ещё только будет нарисована: иначе при сдвиге карты машины ехали отдельно от неё.
            val project = projector(viewport, density)
            val margin = 200f * density * scale
            // Севернее - раньше, южнее - поверх (z-index по широте у Leaflet).
            val items = tracks.values.sortedByDescending { it.motion.lat }
            val out = ArrayList<Drawn>(items.size)
            val start = renderer.badgesStart
            for (track in items) {
                val motion = track.motion
                val (x, y) = project(motion.lat, motion.lng)
                if (x < -margin || y < -margin || x > size.width + margin || y > size.height + margin) continue
                val m = track.mark
                val v = m.vehicle
                val course = (((motion.dir % 360) + 360) % 360).toFloat()
                val east = course > 45 && course < 135
                val center = Offset(x, y)
                scale(scale, center) {
                    with(renderer) {
                        drawArrow(center, course - bearing, m.type, m.stale, dark)
                        drawBody(center, m.type, v.routeNumber, east, v.lowFloor, m.warning, m.stale, dark)
                    }
                }
                val badges = renderer.badgesWidth(v.routeNumber, v.lowFloor || m.warning) * scale
                val near = start * scale
                out += if (east) Drawn(v.deviceCode, x, y, x - near - badges, x) else Drawn(v.deviceCode, x, y, x, x + near + badges)
            }
            drawn = out
        }
    }
}

/**
 * Перевод широты и долготы в пиксели экрана по кадру карты (Web Mercator, как у MapLibre: мир -
 * 512 dp на нулевом масштабе; центр кадра сдвинут отступами камеры).
 */
internal fun projector(viewport: org.maplibre.compose.camera.Viewport, density: Float): (Double, Double) -> Pair<Float, Float> {
    val camera = viewport.cameraPosition
    val world = 512.0 * 2.0.pow(camera.zoom)
    fun mx(lng: Double) = (lng + 180.0) / 360.0 * world
    fun my(lat: Double): Double {
        val phi = lat * PI / 180
        return (1 - ln(tan(phi) + 1 / cos(phi)) / PI) / 2 * world
    }
    val pad = camera.padding
    val w = viewport.size.width.value
    val h = viewport.size.height.value
    val cx = pad.left.value + (w - pad.left.value - pad.right.value) / 2
    val cy = pad.top.value + (h - pad.top.value - pad.bottom.value) / 2
    val tx = mx(camera.target.longitude)
    val ty = my(camera.target.latitude)
    val angle = -camera.bearing * PI / 180
    val c = cos(angle)
    val sn = sin(angle)
    return { lat, lng ->
        val dx = mx(lng) - tx
        val dy = my(lat) - ty
        val x = cx + dx * c - dy * sn
        val y = cy + dx * sn + dy * c
        (x * density).toFloat() to (y * density).toFloat()
    }
}
