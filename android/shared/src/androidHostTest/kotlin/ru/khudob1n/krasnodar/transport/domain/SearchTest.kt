package ru.khudob1n.krasnodar.transport.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import ru.khudob1n.krasnodar.transport.ui.components.TransportType

/** Поиск по справочнику Краснодара - правила SearchBar.helpers.ts сайта. */
class SearchTest {
    private val catalog = TestData.catalog

    @Test
    fun `вид и номер в любом порядке`() {
        for (q in listOf("трамвай 4", "4 трамвай", "тм 4", "трам 4")) {
            val routes = search(catalog, normalizeSearch(q)).routes
            assertTrue(q, routes.isNotEmpty())
            assertTrue(q, routes.all { it.transport == TransportType.Tram && it.number.startsWith("4") })
        }
    }

    @Test
    fun `номер 2 - это 2 и 2Е, но не 20`() {
        val numbers = search(catalog, normalizeSearch("автобус 2")).routes.map { it.number }.toSet()
        assertTrue(numbers.contains("2"))
        assertFalse(numbers.any { it.startsWith("2") && it.length > 1 && it[1].isDigit() })
    }

    @Test
    fun `слово вида - все маршруты вида`() {
        val routes = search(catalog, normalizeSearch("троллейбусы")).routes
        assertEquals(catalog.routeStops.count { it.transport == TransportType.Troll }, routes.size)
    }

    @Test
    fun `номера маршрутов сортируются по числу`() {
        val numbers = search(catalog, normalizeSearch("трамваи")).routes.map { it.number }
        val asNumbers = numbers.map { it.takeWhile(Char::isDigit).toInt() }
        assertEquals(asNumbers.sorted(), asNumbers)
    }

    @Test
    fun `остановки без учёта регистра и ё`() {
        val a = search(catalog, normalizeSearch("УЛ.МИРА")).stops
        assertTrue(a.any { it.name == "ул.Мира" })
        assertEquals(normalizeSearch("Ёлка"), normalizeSearch("елка"))
    }

    @Test
    fun `вокзалы и депо находятся`() {
        assertTrue(search(catalog, normalizeSearch("краснодар-1")).stations.isNotEmpty())
        assertTrue(search(catalog, normalizeSearch("депо")).depots.isNotEmpty())
    }
}
