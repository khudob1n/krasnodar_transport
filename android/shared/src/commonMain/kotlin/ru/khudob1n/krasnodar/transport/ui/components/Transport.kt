package ru.khudob1n.krasnodar.transport.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.graphics.Color
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme

/** Вид транспорта - ClientUnit на сайте. */
enum class TransportType(val iconName: String, val title: String) {
    Bus("bus", "Автобус"),
    Troll("troll", "Троллейбус"),
    Tram("tram", "Трамвай"),
}

val TransportType.color: Color
    @Composable @ReadOnlyComposable get() = when (this) {
        TransportType.Bus -> AppTheme.colors.bus
        TransportType.Troll -> AppTheme.colors.troll
        TransportType.Tram -> AppTheme.colors.tram
    }
