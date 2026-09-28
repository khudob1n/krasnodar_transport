package ru.khudob1n.krasnodar.transport.platform

import kotlin.math.abs
import kotlin.math.pow
import kotlin.math.roundToLong

/** Число с [digits] знаками после точки ("%.6f" в Locale.US). */
fun Double.fixed(digits: Int): String {
    val factor = 10.0.pow(digits)
    val scaled = (abs(this) * factor).roundToLong()
    val int = scaled / factor.toLong()
    val frac = (scaled % factor.toLong()).toString().padStart(digits, '0')
    val sign = if (this < 0 && scaled != 0L) "-" else ""
    return if (digits == 0) "$sign$int" else "$sign$int.$frac"
}

/** Двузначное число с нулём впереди ("%02d"). */
fun Int.pad2(): String = toString().padStart(2, '0')

/** ARGB -> "#RRGGBB". */
fun Int.hexRgb(): String = "#" + (this and 0xFFFFFF).toString(16).uppercase().padStart(6, '0')

fun Double.toRadians(): Double = this * kotlin.math.PI / 180

fun Double.toDegrees(): Double = this * 180 / kotlin.math.PI
