package ru.khudob1n.krasnodar.transport.map

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.os.SystemClock
import android.view.View
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.maps.MapLibreMap
import ru.khudob1n.krasnodar.transport.data.LatLngPoint
import ru.khudob1n.krasnodar.transport.data.Vehicle
import ru.khudob1n.krasnodar.transport.ui.components.TransportType
import java.time.Duration
import java.time.Instant
import kotlin.math.hypot

/** Машина, как её рисовать: stale - координаты устарели, warning - не на линии своего маршрута. */
data class VehicleMark(val vehicle: Vehicle, val type: TransportType, val stale: Boolean, val warning: Boolean)

/** Сколько машина едет к новому положению: столько, сколько прошло между отметками (раз в ~25 с). */
private const val DEFAULT_MOVE_MS = 5_000L
private const val MIN_MOVE_MS = 1_000L
private const val MAX_MOVE_MS = 40_000L
/** Кадров в секунду, пока машины едут: они ползут медленно, 30 хватает, а батарею бережёт. */
private const val FRAME_MS = 33L

/**
 * Машины поверх карты - как маркеры сайта (Leaflet, по элементу на машину): каждая рисуется
 * целиком - капля, пиктограмма и бейджи, южнее - поверх. В слое MapLibre так не выходит: там
 * порядок держится только внутри тайла, и бейджи одних машин ложились на капли других.
 *
 * Движение плавное: получив новое положение, машина не прыгает, а едет к нему от того места,
 * где нарисована, столько времени, сколько прошло между её отметками, - к следующей отметке
 * как раз доезжает (moveToWithDuration сайта; скорости источник Краснодара не отдаёт).
 */
@SuppressLint("ViewConstructor")
class VehicleOverlay(context: Context, private val map: MapLibreMap, private val renderer: MarkerRenderer) : View(context) {
    private class Track(
        val fromLat: Double, val fromLng: Double, val fromDir: Double,
        var mark: VehicleMark, val start: Long, val duration: Long,
    ) {
        fun progress(now: Long) = if (duration <= 0) 1.0 else ((now - start).toDouble() / duration).coerceIn(0.0, 1.0)
        fun lat(t: Double) = fromLat + (mark.vehicle.lat - fromLat) * t
        fun lng(t: Double) = fromLng + (mark.vehicle.lng - fromLng) * t
        fun dir(t: Double) = fromDir + (((mark.vehicle.dir - fromDir + 540) % 360) - 180) * t
    }

    /** Нарисованная в последнем кадре машина - для нажатий. */
    private class Drawn(val id: String, val x: Float, val y: Float, val left: Float, val right: Float)

    private var tracks = LinkedHashMap<String, Track>()
    private var drawn: List<Drawn> = emptyList()
    private val arrows = HashMap<String, Bitmap>()
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private val density = resources.displayMetrics.density

    /** Размер машин из настроек (1 - как на сайте). */
    var scale = 1f
        set(value) { field = value; invalidate() }
    var dark = false
        set(value) { field = value; invalidate() }
    /** «Уменьшить движение»: машины переставляются сразу. */
    var animate = true

    /** «Наблюдать за движением»: камера едет вместе с этой машиной. */
    var follow: String? = null
        set(value) { field = value; invalidate() }

    private var frameScheduled = false
    private val frame = Runnable {
        frameScheduled = false
        follow?.let { id -> position(id)?.let { map.moveCamera(CameraUpdateFactory.newLatLng(LatLng(it.lat, it.lng))) } }
        invalidate()
    }

    init {
        map.addOnCameraMoveListener { invalidate() }
        map.addOnCameraIdleListener { invalidate() }
    }

    fun setMarks(marks: List<VehicleMark>) {
        val now = SystemClock.uptimeMillis()
        val next = LinkedHashMap<String, Track>(marks.size)
        for (m in marks) {
            val v = m.vehicle
            val old = tracks[v.deviceCode]
            next[v.deviceCode] = when {
                old == null -> Track(v.lat, v.lng, v.dir, m, now, 0)
                // Положение то же (опрос чаще, чем машина отмечается) - едет дальше как ехала.
                old.mark.vehicle.lat == v.lat && old.mark.vehicle.lng == v.lng && old.mark.vehicle.dir == v.dir -> old.also { it.mark = m }
                else -> {
                    val t = old.progress(now)
                    val duration = if (animate) moveDuration(old.mark.vehicle.navTime, v.navTime) else 0L
                    Track(old.lat(t), old.lng(t), old.dir(t), m, now, duration)
                }
            }
        }
        tracks = next
        invalidate()
    }

    private fun moveDuration(from: String?, to: String?): Long {
        val ms = runCatching { Duration.between(Instant.parse(from), Instant.parse(to)).toMillis() }.getOrNull()
        return (ms?.takeIf { it > 0 } ?: DEFAULT_MOVE_MS).coerceIn(MIN_MOVE_MS, MAX_MOVE_MS)
    }

    /** Где машина нарисована сейчас. */
    fun position(id: String): LatLngPoint? {
        val track = tracks[id] ?: return null
        val t = track.progress(SystemClock.uptimeMillis())
        return LatLngPoint(track.lat(t), track.lng(t))
    }

    /** Машина под точкой экрана (верхняя - южнее), или null. */
    fun vehicleAt(x: Float, y: Float): String? {
        val r = 22f * density * scale
        return drawn.lastOrNull { d ->
            hypot(x - d.x, y - d.y) <= r || (x in d.left..d.right && y in d.y - r * 0.8f..d.y + r * 0.8f)
        }?.id
    }

    private fun arrow(type: TransportType, stale: Boolean): Bitmap =
        arrows.getOrPut("$type|$stale|$dark") { renderer.arrow(type, stale, dark) }

    override fun onDraw(canvas: Canvas) {
        val now = SystemClock.uptimeMillis()
        val projection = map.projection
        val bearing = map.cameraPosition.bearing.toFloat()
        val margin = 200f * density * scale
        var moving = false
        // Севернее - раньше, южнее - поверх (z-index по широте у Leaflet).
        val items = tracks.values.map { track ->
            val t = track.progress(now)
            if (t < 1.0) moving = true
            Triple(track, t, track.lat(t))
        }.sortedByDescending { it.third }
        val out = ArrayList<Drawn>(items.size)
        val start = renderer.badgesStart
        for ((track, t, lat) in items) {
            val p = projection.toScreenLocation(LatLng(lat, track.lng(t)))
            if (p.x < -margin || p.y < -margin || p.x > width + margin || p.y > height + margin) continue
            val m = track.mark
            val v = m.vehicle
            val course = ((track.dir(t) % 360) + 360) % 360
            val east = course > 45 && course < 135
            canvas.save()
            canvas.translate(p.x, p.y)
            canvas.scale(scale, scale)
            val drop = arrow(m.type, m.stale)
            canvas.save()
            canvas.rotate(course.toFloat() - bearing)
            canvas.drawBitmap(drop, -drop.width / 2f, -drop.height / 2f, paint)
            canvas.restore()
            renderer.drawBody(canvas, 0f, 0f, m.type, v.routeNumber, east, v.lowFloor, m.warning, m.stale, dark)
            canvas.restore()
            val badges = renderer.badgesWidth(v.routeNumber, v.lowFloor || m.warning) * scale
            val near = start * scale
            out += if (east) Drawn(v.deviceCode, p.x, p.y, p.x - near - badges, p.x) else Drawn(v.deviceCode, p.x, p.y, p.x, p.x + near + badges)
        }
        drawn = out
        if (moving && !frameScheduled) {
            frameScheduled = true
            postOnAnimationDelayed(frame, FRAME_MS)
        }
    }
}
