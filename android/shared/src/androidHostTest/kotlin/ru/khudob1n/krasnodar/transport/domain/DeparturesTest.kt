package ru.khudob1n.krasnodar.transport.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import ru.khudob1n.krasnodar.transport.data.ScheduleTrip
import kotlinx.datetime.LocalDateTime

class DeparturesTest {
    private fun at(day: Int, hour: Int, minute: Int) = LocalDateTime(2026, 9, day, hour, minute, 0, 0)
    private val monday = 28
    private val saturday = 26

    private fun trip(route: String, time: String, to: String = "Вокзал", day: String = "будни", type: String = "Трамвай") =
        ScheduleTrip(stopId = 1, routeNumber = route, routeType = type, dayType = day, time = time, toStation = to)

    @Test
    fun `тип дня по дню недели`() {
        assertEquals("будни", dayTypeOf(at(monday, 12, 0)))
        assertEquals("выходные", dayTypeOf(at(saturday, 12, 0)))
    }

    @Test
    fun `ближайшие - по одному на маршрут и конечную, по времени, без прошедших`() {
        val trips = listOf(
            trip("4", "08:10"), trip("4", "08:20"), trip("2", "08:15"),
            trip("2", "08:05", to = "Депо"), trip("4", "07:50"),
        )
        val board = stopBoard(trips, at(monday, 8, 0)) as StopBoard.Departures
        assertEquals(listOf("2@08:05", "4@08:10", "2@08:15"), board.items.map { "${it.route}@${it.time}" })
    }

    @Test
    fun `рейс в текущую минуту ещё показывается`() {
        val board = stopBoard(listOf(trip("4", "08:00")), at(monday, 8, 0))
        assertTrue(board is StopBoard.Departures)
    }

    @Test
    fun `нет расписания, не ходит сегодня, рейсы кончились`() {
        assertEquals(StopBoard.NoSchedule, stopBoard(emptyList(), at(monday, 8, 0)))
        assertEquals(StopBoard.NoServiceToday, stopBoard(listOf(trip("4", "08:10", day = "будни")), at(saturday, 8, 0)))
        assertEquals(StopBoard.NoMoreToday, stopBoard(listOf(trip("4", "07:10")), at(monday, 23, 0)))
    }

    @Test
    fun `незнакомый вид транспорта пропускается`() {
        assertEquals(StopBoard.NoMoreToday, stopBoard(listOf(trip("1", "09:00", type = "Метро")), at(monday, 8, 0)))
    }

    @Test
    fun `формат прибытия`() {
        val now = at(monday, 8, 0)
        assertEquals("сейчас", formatArrival("08:00", now = now))
        assertEquals("5 мин", formatArrival("08:05", now = now))
        assertEquals("15 мин", formatArrival("08:15", now = now))
        assertEquals("08:16", formatArrival("08:16", now = now))
        assertEquals("08:05", formatArrival("08:05", ArrivalFormat.Absolute, now))
        // После полуночи: 00:05 при 23:58 - через 7 минут, а не вчера.
        assertEquals("7 мин", formatArrival("00:05", now = at(monday, 23, 58)))
    }

    @Test
    fun `склонения`() {
        val f = { n: Int -> "$n ${plural(n, "остановка", "остановки", "остановок")}" }
        assertEquals(
            listOf("1 остановка", "2 остановки", "5 остановок", "11 остановок", "12 остановок", "21 остановка", "22 остановки", "111 остановок"),
            listOf(1, 2, 5, 11, 12, 21, 22, 111).map(f),
        )
    }
}
