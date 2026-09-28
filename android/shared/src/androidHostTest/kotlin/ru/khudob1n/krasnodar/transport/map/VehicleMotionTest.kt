package ru.khudob1n.krasnodar.transport.map

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import ru.khudob1n.krasnodar.transport.data.LatLngPoint
import kotlin.math.hypot

/** Движение машины между неровными отметками: без остановок, скачков и езды назад. */
class VehicleMotionTest {
    // Прямая улица на север ~2.2 км.
    private val line = RouteLine(listOf(LatLngPoint(45.00, 38.97), LatLngPoint(45.02, 38.97)))
    private fun northOf(m: Double) = 45.00 + m / 111_320.0
    private fun meters(a: Double, b: Double) = (b - a) * 111_320.0

    @Test
    fun `едет ровно, не встаёт и не обгоняет отметку при неровных отметках`() {
        val motion = VehicleMotion(line, northOf(0.0), 38.97, 0.0, now = 0)
        // Машина едет 10 м/с, отметки приходят через 20, 5, 40 и 15 с.
        val fixes = listOf(20_000L, 25_000L, 65_000L, 80_000L)
        var prev = motion.lat
        var maxStep = 0.0
        var stoodStill = 0
        var fix = 0
        for (t in 16L..100_000L step 16L) {
            if (fix < fixes.size && t >= fixes[fix]) {
                motion.fix(northOf(fixes[fix] / 100.0), 38.97, 0.0, t, line)
                fix++
            }
            motion.advance(t)
            val step = meters(prev, motion.lat)
            assertTrue("назад на $t мс", step >= -1e-6)
            val lastFix = fixes.lastOrNull { it <= t } ?: 0L
            assertTrue("обогнала отметку на $t мс", meters(northOf(lastFix / 100.0), motion.lat) <= 0.01)
            maxStep = maxOf(maxStep, step)
            if (t in 25_000L..80_000L && step < 1e-4) stoodStill++
            prev = motion.lat
        }
        // Не больше 25 м/с даже при догоне (за кадр 16 мс - 0.4 м) и без остановок посреди пути.
        assertTrue("скачок $maxStep м за кадр", maxStep < 0.45)
        assertEquals(0, stoodStill)
    }

    @Test
    fun `скачок больше километра - переставляется сразу`() {
        val motion = VehicleMotion(line, northOf(0.0), 38.97, 0.0, now = 0)
        motion.fix(northOf(1_500.0), 38.97, 0.0, 20_000, line)
        motion.advance(20_016)
        assertEquals(1_500.0, meters(45.00, motion.lat), 1.0)
    }

    @Test
    fun `не на линии - едет по прямой к отметке`() {
        val motion = VehicleMotion(null, 45.0, 38.97, 90.0, now = 0)
        motion.fix(45.0, 38.971, 90.0, 20_000, null)
        var t = 20_000L
        repeat(6_000) { t += 16; motion.advance(t) }
        assertTrue(hypot(motion.lat - 45.0, motion.lng - 38.971) < 1e-5)
    }
}
