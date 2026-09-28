package ru.khudob1n.krasnodar.transport.settings

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Избранное - формат файла сайта izbrannoe-transport-krd.json и правила FavoritesProvider. */
class FavoritesTest {
    @Test
    fun `файл сайта читается, мусор пропускается`() {
        val f = Favorites.parse("""{"stopIds":["100", 5, null],"routeIds":[2625818258,"x"],"stopNames":{"100":" Дом ","7":"","8":5},"extra":1}""")
        assertEquals(listOf("100"), f.stopIds)
        assertEquals(listOf(2625818258L), f.routeIds)
        assertEquals(mapOf("100" to "Дом"), f.stopNames)
        assertTrue(Favorites.parse("не json").isEmpty)
    }

    @Test
    fun `туда и обратно без потерь`() {
        val f = Favorites(listOf("100"), listOf(42L), mapOf("100" to "Работа"))
        assertEquals(f, Favorites.parse(f.toJson()))
    }

    @Test
    fun `убрали остановку - своё название тоже`() {
        val f = Favorites().toggleStop(100).rename(100, "Дом").toggleStop(100)
        assertFalse(f.hasStop(100))
        assertTrue(f.stopNames.isEmpty())
    }

    @Test
    fun `название обрезается до 40, пустое возвращает официальное`() {
        val f = Favorites().toggleStop(1).rename(1, "x".repeat(60))
        assertEquals(40, f.stopNames["1"]!!.length)
        assertTrue(f.rename(1, "  ").stopNames.isEmpty())
    }

    @Test
    fun `импорт дополняет, свои названия важнее`() {
        val mine = Favorites(listOf("1"), listOf(10L), mapOf("1" to "Дом"))
        val file = Favorites(listOf("1", "2"), listOf(10L, 20L), mapOf("1" to "Из файла", "2" to "Работа"))
        val merged = mine.merge(file)
        assertEquals(listOf("1", "2"), merged.stopIds)
        assertEquals(listOf(10L, 20L), merged.routeIds)
        assertEquals(mapOf("1" to "Дом", "2" to "Работа"), merged.stopNames)
    }
}
