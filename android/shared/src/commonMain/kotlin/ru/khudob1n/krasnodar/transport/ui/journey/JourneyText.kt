package ru.khudob1n.krasnodar.transport.ui.journey

import ru.khudob1n.krasnodar.transport.platform.fixed

import ru.khudob1n.krasnodar.transport.domain.DepartureSource
import ru.khudob1n.krasnodar.transport.domain.Leg
import ru.khudob1n.krasnodar.transport.domain.isPlaceId
import ru.khudob1n.krasnodar.transport.domain.plural
import kotlin.math.max
import kotlin.math.roundToInt

// Подписи и форматирование шагов маршрута (components/Map/Journey/journeyText.ts сайта).

fun formatDuration(minutes: Double): String {
    val total = max(1, minutes.roundToInt())
    if (total < 60) return "$total мин"
    val hours = total / 60
    val rest = total % 60
    return if (rest > 0) "$hours ч $rest мин" else "$hours ч"
}

fun formatMeters(meters: Double): String =
    if (meters < 1000) "${max(10, (meters / 10).roundToInt() * 10)} м"
    else (meters / 1000).fixed(1).replace('.', ',') + " км"

fun stopsWord(count: Int) = plural(count, "остановка", "остановки", "остановок")

val DepartureSource.note get() = when (this) {
    DepartureSource.Schedule -> "по расписанию"
    DepartureSource.Estimate -> "примерно, расписания нет"
}

/** Текст пешего шага: к остановке, на ту же остановку напротив, к месту. */
fun walkText(leg: Leg.WalkLeg, isLast: Boolean, nameOf: (Long) -> String): String {
    val distance = formatMeters(leg.meters)
    val from = nameOf(leg.from)
    val to = nameOf(leg.to)
    if (isLast && isPlaceId(leg.to)) return "Пешком $distance до «$to»"
    if (isPlaceId(leg.from)) return "Пешком $distance к остановке «$to»"
    if (from == to) {
        return if (leg.meters < 150) "Перейдите на остановку «$to» напротив — $distance"
        else "Пешком $distance к другой остановке «$to»"
    }
    return "Пешком $distance ${if (isLast) "до" else "к остановке"} «$to»"
}

