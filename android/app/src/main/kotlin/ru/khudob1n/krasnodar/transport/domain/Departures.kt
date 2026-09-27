package ru.khudob1n.krasnodar.transport.domain

import ru.khudob1n.krasnodar.transport.data.ScheduleTrip
import ru.khudob1n.krasnodar.transport.data.transportOfRu
import ru.khudob1n.krasnodar.transport.ui.components.TransportType
import java.time.DayOfWeek
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.temporal.ChronoUnit

/** Время Краснодара - расписание КТТУ в местном времени, а телефон может жить в другом поясе. */
val CITY_ZONE: ZoneId = ZoneId.of("Europe/Moscow")

fun cityNow(): ZonedDateTime = ZonedDateTime.now(CITY_ZONE)

/** «будни» / «выходные» - как day_type в расписании (getStopInfo на сайте). */
fun dayTypeOf(now: ZonedDateTime): String =
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
fun stopBoard(trips: List<ScheduleTrip>, now: ZonedDateTime = cityNow()): StopBoard {
    if (trips.isEmpty()) return StopBoard.NoSchedule
    val today = trips.filter { it.dayType == dayTypeOf(now) }
    if (today.isEmpty()) return StopBoard.NoServiceToday
    val nowLabel = "%02d:%02d".format(now.hour, now.minute)
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
fun formatArrival(time: String, format: ArrivalFormat = ArrivalFormat.Relative, now: ZonedDateTime = cityNow()): String {
    if (format == ArrivalFormat.Absolute) return time
    val (h, m) = time.split(':').map(String::toInt)
    var at = now.with(LocalTime.of(h % 24, m)).truncatedTo(ChronoUnit.MINUTES)
    if (at.isBefore(now.minusHours(12))) at = at.plusDays(1)
    val minutes = ChronoUnit.MINUTES.between(now.truncatedTo(ChronoUnit.MINUTES), at).coerceAtLeast(0)
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
