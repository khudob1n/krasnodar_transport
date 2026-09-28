package ru.khudob1n.krasnodar.transport.ui

import androidx.compose.ui.geometry.Offset
import org.junit.Assert.assertEquals
import org.junit.Test
import ru.khudob1n.krasnodar.transport.ui.components.SvgDoc

/**
 * Преобразования групп SVG (сами фигуры на JVM не проверить: Path на Android-заглушках). Точка у
 * Compose - строка (p·M), поэтому порядок умножения легко перепутать - капли уезжали от номеров.
 */
class SvgTest {
    private fun assertNear(expected: Offset, actual: Offset) {
        assertEquals("x", expected.x, actual.x, 0.05f)
        assertEquals("y", expected.y, actual.y, 0.05f)
    }

    @Test
    fun `translate потом scale - сначала масштаб, потом сдвиг, как в SVG`() {
        // bus-arrow.svg: острие капли (786.774, 30.804) в группе translate(-347.247,-11.717) scale(0.465).
        val m = SvgDoc.transformOf("translate(-347.247,-11.717) scale(0.465)")
        assertNear(Offset(786.774f * 0.465f - 347.247f, 30.804f * 0.465f - 11.717f), m.map(Offset(786.774f, 30.804f)))
    }

    @Test
    fun `matrix(a,b,c,d,e,f) - как в SVG`() {
        val m = SvgDoc.transformOf("matrix(2,0,0,3,5,7)")
        assertNear(Offset(2f * 1 + 5, 3f * 1 + 7), m.map(Offset(1f, 1f)))
    }
}
