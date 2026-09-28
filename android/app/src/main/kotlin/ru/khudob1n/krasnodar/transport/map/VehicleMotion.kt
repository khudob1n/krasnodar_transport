package ru.khudob1n.krasnodar.transport.map

import ru.khudob1n.krasnodar.transport.data.LatLngPoint
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sign

/** Метров в градусе широты; долгота - с поправкой на широту Краснодара. */
private const val M_PER_DEG = 111_320.0
private val M_PER_DEG_LNG = M_PER_DEG * cos(Math.toRadians(45.04))

/** Дальше этого от линии маршрута отметка - машина не на ней, едет по прямой. */
private const val OFF_LINE_M = 60.0
/** Быстрее не ездят (90 км/ч): быстрее - это скачок данных, а не скорость. */
private const val MAX_SPEED = 25.0
/** Отстала дальше - переставляем сразу: столько за минуту между отметками не проезжают. */
private const val SNAP_M = 1_000.0
/** Разгон, м/с² (торможение - вдвое резче). */
private const val ACCEL = 1.5
/** Поворот капли, градусов в секунду. */
private const val TURN_DEG_S = 240.0

/** Линия маршрута в метрах на плоскости и пройденное расстояние до каждой точки. */
class RouteLine(points: List<LatLngPoint>) {
    private val x = DoubleArray(points.size) { points[it].lng * M_PER_DEG_LNG }
    private val y = DoubleArray(points.size) { points[it].lat * M_PER_DEG }
    private val along = DoubleArray(points.size)
    val length: Double

    init {
        for (i in 1 until points.size) along[i] = along[i - 1] + hypot(x[i] - x[i - 1], y[i] - y[i - 1])
        length = along.lastOrNull() ?: 0.0
    }

    /**
     * Ближайшее место на линии: (пройдено, расстояние до линии). near - где машина была: линия
     * может проходить по той же улице дважды (туда и обратно), и назад по ней машина не едет.
     */
    fun project(p: LatLngPoint, near: Double?): Pair<Double, Double>? {
        val px = p.lng * M_PER_DEG_LNG
        val py = p.lat * M_PER_DEG
        var best: Triple<Double, Double, Double>? = null // цена, пройдено, расстояние
        for (i in 0 until x.size - 1) {
            val dx = x[i + 1] - x[i]
            val dy = y[i + 1] - y[i]
            val len2 = dx * dx + dy * dy
            val t = if (len2 == 0.0) 0.0 else (((px - x[i]) * dx + (py - y[i]) * dy) / len2).coerceIn(0.0, 1.0)
            val d = hypot(x[i] + dx * t - px, y[i] + dy * t - py)
            val s = along[i] + (along[i + 1] - along[i]) * t
            val cost = d + if (near != null && s < near - 50) 200.0 else 0.0
            if (best == null || cost < best.first) best = Triple(cost, s, d)
        }
        return best?.let { it.second to it.third }
    }

    /** Точка на линии и направление движения (градусы от севера по часовой). */
    fun at(s: Double): Triple<Double, Double, Double> {
        val d = s.coerceIn(0.0, length)
        var i = along.indexOfFirst { it >= d }.let { if (it <= 0) 1 else it }
        if (i >= x.size) i = x.size - 1
        val seg = along[i] - along[i - 1]
        val t = if (seg == 0.0) 0.0 else (d - along[i - 1]) / seg
        val px = x[i - 1] + (x[i] - x[i - 1]) * t
        val py = y[i - 1] + (y[i] - y[i - 1]) * t
        val course = Math.toDegrees(atan2(x[i] - x[i - 1], y[i] - y[i - 1]))
        return Triple(py / M_PER_DEG, px / M_PER_DEG_LNG, (course + 360) % 360)
    }
}

/**
 * Где рисовать машину между отметками. Отметки приходят неровно - то через 5 с, то через 45,
 * поэтому «доехать к новой точке за время между отметками» давало рывки: машина то стояла, то
 * срывалась. Здесь машина догоняет последнюю отметку по линии своего маршрута со скоростью
 * «оставшийся путь / обычный промежуток между отметками», а скорость меняется плавно (разгон и
 * торможение ограничены): отметка запаздывает - машина плавно сбавляет ход, а не встаёт; пришла
 * новая - плавно разгоняется. Дальше отметки не уезжает и назад по линии не ездит. Не на линии
 * (или линии нет) - так же, но по прямой.
 */
class VehicleMotion(private var line: RouteLine?, lat: Double, lng: Double, dir: Double, now: Long) {
    var lat = lat; private set
    var lng = lng; private set
    var dir = dir; private set

    /** Пройдено по линии там, где машина нарисована; null - не на линии. */
    private var s: Double? = line?.project(LatLngPoint(lat, lng), null)?.takeIf { it.second <= OFF_LINE_M }?.first
    private var fixS = s ?: 0.0
    private var fixLat = lat
    private var fixLng = lng
    private var fixAt = now
    private var speed = 0.0
    private var gapMs = 20_000.0
    private var targetDir = dir
    private var lastFrame = now

    /** Ещё едет или поворачивает - нужны следующие кадры. */
    var moving = false; private set

    /** Новая отметка машины. */
    fun fix(lat: Double, lng: Double, dir: Double, now: Long, newLine: RouteLine?) {
        val gap = (now - fixAt).toDouble()
        if (gap > 0) gapMs = (gapMs * 2 + gap.coerceIn(5_000.0, 60_000.0)) / 3
        fixAt = now
        fixLat = lat
        fixLng = lng
        targetDir = dir
        if (newLine !== line) { line = newLine; s = null }
        val proj = line?.project(LatLngPoint(lat, lng), s)?.takeIf { it.second <= OFF_LINE_M }
        if (proj == null) { s = null; return }
        val shown = s
        // Встала на линию или начала рейс заново (кольцо) - на линию сразу, догонять незачем.
        if (shown == null || proj.first < shown - 50) { s = proj.first; speed = 0.0 }
        fixS = proj.first
        moving = true
    }

    /** Сдвинуть к моменту now (мс, uptime). */
    fun advance(now: Long) {
        // Кадры идут, только пока кто-то едет: после паузы шаг - не больше кадра, иначе машина прыгнет.
        val dt = ((now - lastFrame) / 1000.0).coerceIn(0.0, 0.1)
        lastFrame = now
        val l = line
        val shown = s
        val remaining = if (l != null && shown != null) max(fixS - shown, 0.0)
        else hypot((fixLat - lat) * M_PER_DEG, (fixLng - lng) * M_PER_DEG_LNG)
        moving = false
        if (remaining > SNAP_M) {
            // Скачок данных (или долго не видели) - переставляем.
            place(l, fixS, fixLat, fixLng)
            speed = 0.0
        } else if (remaining > 0.2 || speed > 0.05) {
            // Путь до отметки - за время, что осталось до следующей (но не меньше половины
            // обычного промежутка): едет ровно, а если отметка запаздывает - плавно сбавляет.
            val left = max(max(gapMs - (now - fixAt), gapMs / 2) / 1000.0, 4.0)
            val desired = (remaining / left).coerceAtMost(MAX_SPEED)
            speed += (desired - speed).coerceIn(-ACCEL * 2 * dt, ACCEL * dt)
            val step = min(speed * dt, remaining)
            if (l != null && shown != null) place(l, shown + step, 0.0, 0.0)
            else if (remaining > 0) {
                val k = step / remaining
                lat += (fixLat - lat) * k
                lng += (fixLng - lng) * k
            }
            moving = true
        }
        // Капля поворачивается плавно, по кратчайшему пути.
        val turn = ((targetDir - dir + 540) % 360) - 180
        if (turn != 0.0) {
            val step = TURN_DEG_S * dt
            dir = if (abs(turn) <= step) targetDir else (dir + step * sign(turn) + 360) % 360
            if (dir != targetDir) moving = true
        }
    }

    private fun place(l: RouteLine?, along: Double, lat: Double, lng: Double) {
        val shown = s
        if (l != null && shown != null) {
            val (plat, plng, course) = l.at(along)
            if (along != shown) targetDir = course
            s = along
            this.lat = plat
            this.lng = plng
        } else {
            this.lat = lat
            this.lng = lng
        }
    }

    /** Без анимации («Уменьшить движение»): сразу в последнюю отметку. */
    fun jump(lat: Double, lng: Double, dir: Double) {
        this.lat = lat; this.lng = lng; this.dir = dir
        targetDir = dir
        fixLat = lat; fixLng = lng
        s = line?.project(LatLngPoint(lat, lng), null)?.takeIf { it.second <= OFF_LINE_M }?.first
        fixS = s ?: 0.0
        speed = 0.0
    }
}
