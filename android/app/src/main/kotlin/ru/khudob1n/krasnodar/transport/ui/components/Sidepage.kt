package ru.khudob1n.krasnodar.transport.ui.components

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animate
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Velocity
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import ru.khudob1n.krasnodar.transport.R
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme
import kotlin.math.abs

/** Развёрнутая карточка - почти весь экран (над ней остаётся полоска карты). */
private const val EXPANDED = 0.94f
/** Отпустили ниже этой доли обычной высоты - карточка закрывается. */
private const val CLOSE_BELOW = 0.6f
/** Доводка после отпускания: без отскока и быстро - мягкая пружина по умолчанию тянулась ~2 с. */
private val SNAP = spring<Float>(dampingRatio = Spring.DampingRatioNoBouncy, stiffness = Spring.StiffnessMedium)
/** Быстрый смах (px/с) - решает направление, а не положение. */
private const val FLING = 1500f

/**
 * Карточка, выезжающая снизу поверх карты (components/UI/Sidepage на мобильной ширине):
 * скругление 24, «ручка» сверху, крестик закрытия справа.
 *
 * Шторка: тянется за палец. Вверх - разворачивается почти на весь экран, вниз - обратно, ещё
 * ниже или смахнуть - закрывается. С прокручиваемым содержимым работает вместе: пока список
 * не долистан до верха, листается он; дальше тянется сама карточка.
 *
 * height - обычная высота долей экрана; null - по содержимому (тогда только смахнуть вниз).
 */
@Composable
fun Sidepage(
    onClose: (() -> Unit)?,
    modifier: Modifier = Modifier,
    height: Float? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val colors = AppTheme.colors
    val density = LocalDensity.current
    val screen = with(density) { LocalConfiguration.current.screenHeightDp.dp.toPx() }
    val base = height?.let { it * screen }
    val expanded = EXPANDED * screen
    val scope = rememberCoroutineScope()
    // Высота карточки (px), если она задана долей экрана; сдвиг вниз - для карточки по
    // содержимому. Во время жеста меняются сразу (без корутин - иначе запоздавшие шаги жеста
    // перебивали доводку), анимируется только доводка после отпускания.
    var sheet by remember { mutableFloatStateOf(base ?: 0f) }
    var shift by remember { mutableFloatStateOf(0f) }
    var settling by remember { mutableStateOf<Job?>(null) }
    LaunchedEffect(base) { if (base != null) sheet = base }

    // Откуда начался жест: при занятом главном потоке движения приходят пачками и скорость
    // выходит нулевой - тогда решаем по направлению.
    var dragFrom by remember { mutableStateOf<Float?>(null) }
    val decide = with(density) { 40.dp.toPx() }

    fun drag(dy: Float): Float {
        settling?.cancel()
        if (dragFrom == null) dragFrom = if (base == null) shift else sheet
        if (base == null) {
            val next = (shift + dy).coerceAtLeast(0f)
            val used = next - shift
            shift = next
            return used
        }
        val next = (sheet - dy).coerceIn(0f, expanded)
        val used = sheet - next
        sheet = next
        return -used
    }

    fun animateSheet(to: Float) {
        settling = scope.launch { animate(sheet, to, animationSpec = SNAP) { v, _ -> sheet = v } }
    }

    fun settle(velocity: Float) {
        val from = dragFrom
        dragFrom = null
        if (base == null) {
            if (shift > with(density) { 80.dp.toPx() } || velocity > FLING) onClose?.invoke()
            else settling = scope.launch { animate(shift, 0f, animationSpec = SNAP) { v, _ -> shift = v } }
            return
        }
        val wasExpanded = from != null && from > base + 1f
        val moved = if (from != null) sheet - from else 0f // > 0 - потянули вверх
        when {
            // Быстрый смах - по направлению.
            velocity > FLING -> if (wasExpanded || sheet > base) animateSheet(base) else onClose?.invoke() ?: animateSheet(base)
            velocity < -FLING -> animateSheet(expanded)
            // Медленно - по тому, куда и насколько потянули.
            onClose != null && sheet < base * CLOSE_BELOW -> onClose()
            moved > decide -> animateSheet(expanded)
            moved < -decide -> if (wasExpanded) animateSheet(base) else onClose?.invoke() ?: animateSheet(base)
            else -> animateSheet(if (wasExpanded) expanded else base)
        }
    }

    val connection = remember(base, expanded) {
        object : NestedScrollConnection {
            // Палец вверх: сначала разворачиваем карточку, потом листается содержимое.
            override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset {
                val grow = base != null && available.y < 0 && sheet < expanded
                return if (grow && source == NestedScrollSource.UserInput) Offset(0f, drag(available.y)) else Offset.Zero
            }

            // Палец вниз, а содержимое уже вверху - тянем карточку вниз.
            override fun onPostScroll(consumed: Offset, available: Offset, source: NestedScrollSource): Offset =
                if (available.y > 0 && source == NestedScrollSource.UserInput) Offset(0f, drag(available.y)) else Offset.Zero

            private fun moved() = if (base != null) abs(sheet - base) > 1f && abs(sheet - expanded) > 1f else shift > 0f

            override suspend fun onPreFling(available: Velocity): Velocity {
                if (!moved()) return Velocity.Zero
                settle(available.y)
                return available
            }

            // Отпустили без броска (или список сам не листался) - всё равно доводим карточку.
            override suspend fun onPostFling(consumed: Velocity, available: Velocity): Velocity {
                if (moved() && settling?.isActive != true) settle(available.y)
                return Velocity.Zero
            }
        }
    }

    Box(
        modifier
            .fillMaxWidth()
            .then(if (base != null) Modifier.height(with(density) { sheet.toDp() }) else Modifier)
            .graphicsLayer { translationY = shift }
            .shadow(16.dp, AppTheme.shapes.sidepage)
            .background(colors.backgroundPrimary, AppTheme.shapes.sidepage)
            // Касания по пустым местам карточки не уходят на карту под ней.
            .pointerInput(Unit) { awaitPointerEventScope { while (true) awaitPointerEvent() } }
            .nestedScroll(connection)
            // Тянуть можно и за непрокручиваемые места: ручку, заголовок, короткую карточку.
            .draggable(
                rememberDraggableState { drag(it) },
                Orientation.Vertical,
                onDragStopped = { settle(it) },
            )
            .semantics {
                if (base != null) customActions = listOf(
                    CustomAccessibilityAction(if (sheet > base + 1f) "Свернуть" else "Развернуть") {
                        animateSheet(if (sheet > base + 1f) base else expanded)
                        true
                    },
                )
            },
    ) {
        Column(Modifier.fillMaxWidth().navigationBarsPadding().padding(top = 20.dp), content = content)
        Box(
            Modifier
                .align(Alignment.TopCenter)
                .padding(top = 7.dp)
                .size(width = 50.dp, height = 5.dp)
                .background(colors.functionalTram.copy(alpha = 0.5f), RoundedCornerShape(10.dp)),
        )
        if (onClose != null) {
            Box(
                Modifier
                    .align(Alignment.TopEnd)
                    .padding(2.dp)
                    // 48 dp - минимальная зона нажатия (крестик сам 24).
                    .size(48.dp)
                    .clickable(role = Role.Button, onClick = onClose),
                contentAlignment = Alignment.Center,
            ) {
                TablerIcon(R.drawable.tabler_x, "Закрыть", tint = colors.textPrimary.copy(alpha = if (colors.isDark) 0.7f else 0.5f))
            }
        }
    }
}
