package ru.khudob1n.krasnodar.transport.domain

import ru.khudob1n.krasnodar.transport.data.ScheduleTrip
import ru.khudob1n.krasnodar.transport.data.transportOfRu
import ru.khudob1n.krasnodar.transport.ui.components.TransportType
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.DayOfWeek
import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.TimeZone
import kotlinx.datetime.minus
import kotlinx.datetime.plus
import kotlinx.datetime.toInstant
import kotlinx.datetime.toLocalDateTime
import ru.khudob1n.krasnodar.transport.platform.pad2
import kotlin.time.Clock

/** Время Краснодара - расписание КТТУ в местном времени, а телефон может жить в другом поясе. */
val CITY_ZONE: TimeZone = TimeZone.of("Europe/Moscow")

/** Сейчас - по часам Краснодара. */
fun cityNow(): LocalDateTime = Clock.System.now().toLocalDateTime(CITY_ZONE)

/** «будни» / «выходные» - как day_type в расписании (getStopInfo на сайте). */
fun dayTypeOf(now: LocalDateTime): String =
    if (now.dayOfWeek == DayOfWeek.SATURDAY || now.dayOfWeek == DayOfWeek.SUNDAY) "выходные" else "будни"

data class Departure(val route: String, val type: TransportType, val to: String, val time: String)

sealed interface StopBoard {
    data class Departures(val items: List<Departure>) : StopBoard
    /** Расписания у остановки нет совсем. */
    data object NoSchedule : StopBoard
    /** Сегодня (будни/выходные) транспорт не ходит. */
    data object NoServiceToday : StopBoard
    /** Сегодня ходил, но рейсы кончились. */
    data object NoMoreToday : StopBoard
}

/**
 * Ближайшие отправления - getStopInfo + nearestItems сайта: рейсы сегодняшнего типа дня не
 * раньше текущей минуты, по одному на пару «маршрут + конечная», по времени.
 */
fun stopBoard(trips: List<ScheduleTrip>, now: LocalDateTime = cityNow()): StopBoard {
    if (trips.isEmpty()) return StopBoard.NoSchedule
    val today = trips.filter { it.dayType == dayTypeOf(now) }
    if (today.isEmpty()) return StopBoard.NoServiceToday
    val nowLabel = "${now.hour.pad2()}:${now.minute.pad2()}"
    val seen = HashSet<String>()
    val items = today.filter { it.time >= nowLabel }.sortedBy { it.time }.mapNotNull { trip ->
        val type = transportOfRu(trip.routeType) ?: return@mapNotNull null
        if (!seen.add("${trip.routeNumber}-$type-${trip.toStation}")) return@mapNotNull null
        Departure(trip.routeNumber, type, trip.toStation, trip.time)
    }
    return if (items.isEmpty()) StopBoard.NoMoreToday else StopBoard.Departures(items)
}

@kotlinx.serialization.Serializable
enum class ArrivalFormat { Relative, Absolute }

/** «сейчас», «N мин» (до 15 минут) или точное время - formatArrival сайта. */
fun formatArrival(time: String, format: ArrivalFormat = ArrivalFormat.Relative, now: LocalDateTime = cityNow()): String {
    if (format == ArrivalFormat.Absolute) return time
    val (h, m) = time.split(':').map(String::toInt)
    val nowMinute = LocalDateTime(now.date, kotlinx.datetime.LocalTime(now.hour, now.minute)).toInstant(CITY_ZONE)
    var at = LocalDateTime(now.date, kotlinx.datetime.LocalTime(h % 24, m)).toInstant(CITY_ZONE)
    if (at < now.toInstant(CITY_ZONE).minus(12, DateTimeUnit.HOUR)) at = at.plus(1, DateTimeUnit.DAY, CITY_ZONE)
    val minutes = ((at - nowMinute).inWholeMinutes).coerceAtLeast(0)
    return when {
        minutes > 15 -> time
        minutes <= 0 -> "сейчас"
        else -> "$minutes мин"
    }
}

/** «1 остановка», «2 остановки», «5 остановок» - getNoun сайта. */
fun plural(n: Int, one: String, few: String, many: String): String {
    val mod10 = n % 10
    val mod100 = n % 100
    return when {
        mod10 == 1 && mod100 != 11 -> one
        mod10 in 2..4 && mod100 !in 12..14 -> few
        else -> many
    }
}
