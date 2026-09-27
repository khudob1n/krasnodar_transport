package ru.khudob1n.krasnodar.transport.ui.components

import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import ru.khudob1n.krasnodar.transport.settings.LocalMapPreferences
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme

/**
 * Пульсация «костей» скелетона (1,3 с, прозрачность 1 → 0,5 → 1, как у сайта). При «Уменьшить
 * движение» - без анимации.
 */
@Composable
private fun pulse(delayMs: Int = 0): Float {
    if (LocalMapPreferences.current.reduceMotion) return 1f
    val alpha by rememberInfiniteTransition(label = "skeleton").animateFloat(
        1f, 0.5f,
        infiniteRepeatable(tween(650, delayMs, LinearOutSlowInEasing), RepeatMode.Reverse),
        label = "pulse",
    )
    return alpha
}

/** Одна «кость» - серая плашка цвета background-secondary, разного в светлой и тёмной теме. */
@Composable
private fun Bone(modifier: Modifier, radius: Dp = 6.dp, alpha: Float) {
    Box(modifier.alpha(alpha).background(AppTheme.colors.backgroundSecondary, RoundedCornerShape(radius)))
}

// Ширины полос чуть разные - иначе список читается как таблица, а не как загружающийся текст.
private val ENDPOINT_WIDTHS = listOf(0.62f, 0.48f, 0.71f)

/**
 * Заглушка ближайших рейсов остановки (MapStopsSidebarStopsListSkeleton сайта): три строки -
 * бейдж маршрута, направление в две полосы, время справа. Геометрия как у строк рейсов, чтобы
 * при появлении данных карточка не прыгала.
 */
@Composable
fun StopBoardSkeleton() {
    val alpha = pulse()
    Column(Modifier.fillMaxWidth().semantics { contentDescription = "Загружаем расписание" }, verticalArrangement = Arrangement.spacedBy(22.dp)) {
        ENDPOINT_WIDTHS.forEach { width ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Bone(Modifier.size(44.dp, 30.dp), radius = 10.dp, alpha = alpha)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Bone(Modifier.fillMaxWidth(width).height(16.dp), alpha = alpha)
                    Bone(Modifier.fillMaxWidth(0.38f).height(12.dp), alpha = alpha)
                }
                Bone(Modifier.width(44.dp).height(14.dp), alpha = alpha)
            }
        }
    }
}

/** Заглушка табло вокзала (RailScheduleLoading сайта): три плашки с пульсацией вразнобой. */
@Composable
fun RailBoardSkeleton() {
    Column(Modifier.fillMaxWidth().semantics { contentDescription = "Загрузка расписания" }, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf(0, 150, 300).forEach { delay ->
            Bone(Modifier.fillMaxWidth().height(58.dp), radius = 10.dp, alpha = pulse(delay) * 0.7f)
        }
    }
}
