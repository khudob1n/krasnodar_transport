package ru.khudob1n.krasnodar.transport.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme

/**
 * Номер маршрута. filled - залитый цветом вида транспорта (списки рейсов, карточки), иначе
 * контурный на фоне карточки - как бейдж у машины на карте. small - size="xs" сайта (избранное).
 */
@Composable
fun RouteBadge(number: String, type: TransportType, modifier: Modifier = Modifier, filled: Boolean = true, large: Boolean = false, small: Boolean = false) {
    val color = type.color
    val shape = AppTheme.shapes.routeBadge
    val base = modifier.defaultMinSize(
        minWidth = when { large -> 56.dp; small -> 34.dp; else -> 44.dp },
        minHeight = when { large -> 40.dp; small -> 24.dp; else -> 30.dp },
    )
    Box(
        if (filled) base.background(color, shape) else base.background(AppTheme.colors.backgroundPrimary, shape).border(2.dp, color, shape),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            number,
            modifier = Modifier.padding(horizontal = if (small) 7.dp else 10.dp),
            style = AppTheme.type.routeNumber.copy(fontSize = when { large -> 26.sp; small -> 14.sp; else -> 18.sp }, lineHeight = if (small) 18.sp else AppTheme.type.routeNumber.lineHeight),
            color = if (filled) Color.White else color,
            maxLines = 1,
        )
    }
}
