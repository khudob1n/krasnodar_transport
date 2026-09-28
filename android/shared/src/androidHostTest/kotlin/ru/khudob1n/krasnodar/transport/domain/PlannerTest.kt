package ru.khudob1n.krasnodar.transport.domain

import kotlinx.coroutines.runBlocking
import kotlinx.serialization.builtins.ListSerializer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import ru.khudob1n.krasnodar.transport.data.Api
import ru.khudob1n.krasnodar.transport.data.RouteStops
import ru.khudob1n.krasnodar.transport.data.ScheduleTrip
import java.io.File
import kotlinx.datetime.LocalDateTime

/** Поиск маршрута на настоящих данных Краснодара (data/ground_transport, те же, что в админке). */
class PlannerTest {
    private val data = File("../../data/ground_transport")
    private val routes: List<RouteStops> by lazy {
        Api.json.decodeFromString(ListSerializer(RouteStops.serializer()), File(data, "route_stops.json").readText())
    }
    private val trips: Map<Long, List<ScheduleTrip>> by lazy {
        Api.json.decodeFromString(ListSerializer(ScheduleTrip.serializer()), File(data, "schedule_trips.json").readText()).groupBy { it.stopId }
    }
    private val graph by lazy { buildGraph(routes) }

    private fun stopNamed(name: String) = graph.stops.values.first { it.name == name }.id

    @Test
    fun `варианты - цепочка без разрывов, от точки до точки`() {
        val from = stopNamed("ул.Мира")
        val to = stopNamed("Стадион \"Кубань\"")
        val options = planJourneys(graph, from, to)
        assertTrue("есть варианты", options.isNotEmpty())
        for (option in options) {
            assertEquals(from, option.legs.first().from)
            assertEquals(to, option.legs.last().to)
            option.legs.zipWithNext().forEach { (a, b) -> assertEquals("шаги стыкуются", a.to, b.from) }
            assertTrue("не больше 3 поездок", option.rides <= MAX_RIDES)
        }
    }

    @Test
    fun `без пересадок - только прямые варианты`() {
        val options = planJourneys(graph, stopNamed("ул.Мира"), stopNamed("Стадион \"Кубань\""), maxRides = 1)
        assertTrue(options.all { it.rides <= 1 })
    }

    @Test
    fun `расписание подставляет рейсы и не уезжает в прошлое`() = runBlocking {
        val now = LocalDateTime(2026, 9, 28, 9, 0, 0, 0) // понедельник
        val options = planJourneys(graph, stopNamed("ул.Мира"), stopNamed("Стадион \"Кубань\""))
        val planned = planSchedules(options, now) { trips[it].orEmpty() }
        val best = planned.first()
        assertTrue("успеваем сегодня", !best.noServiceToday)
        best.legs.filterIsInstance<PlannedLeg.RideStep>().forEach {
            assertTrue("рейс не раньше готовности", it.departure >= it.ready)
            assertTrue("приезд после отправления", it.arrival > it.departure)
        }
        assertTrue(best.arrival > best.start)
    }
}

