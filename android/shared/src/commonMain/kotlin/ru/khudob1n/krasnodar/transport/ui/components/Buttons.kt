package ru.khudob1n.krasnodar.transport.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme

/** Круглая кнопка карты 48px (components/UI/MapButton): инфо, «Рядом», настройки, тема, масштаб. */
@Composable
fun MapButton(
    icon: SvgIcon,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    opened: Boolean = false,
    iconRotation: Float = 0f,
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val colors = AppTheme.colors
    val shape = AppTheme.shapes.mapButton
    Box(
        modifier
            .scale(pressScale(pressed, 0.94f))
            .size(48.dp)
            .shadow(6.dp, shape, ambientColor = colors.textPrimary.copy(alpha = 0.2f))
            .background(colors.backgroundPrimary, shape)
            .clickable(interaction, indication = null, role = Role.Button, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        TablerIcon(icon, contentDescription, Modifier.rotate(iconRotation), tint = if (opened) colors.functionalTram else colors.textPrimary)
    }
}

/**
 * Второстепенная кнопка в карточках (components/UI/PillButton): «Расписание», «В избранное».
 * enabled = false - полупрозрачная и не нажимается; danger - красная («Да, сбросить всё»).
 */
@Composable
fun PillButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: SvgIcon? = null,
    iconTint: androidx.compose.ui.graphics.Color? = null,
    enabled: Boolean = true,
    danger: Boolean = false,
    active: Boolean = false,
    trailing: (@Composable () -> Unit)? = null,
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val colors = AppTheme.colors
    val background = if (danger) DANGER else colors.backgroundSecondary
    val content = if (danger) androidx.compose.ui.graphics.Color.White else colors.textPrimary
    Row(
        modifier
            .pillWidth()
            .alpha(if (enabled) 1f else 0.45f)
            .scale(pressScale(pressed, 0.97f))
            .heightIn(min = 38.dp)
            // Нажата или раскрыла своё (расписание) - подкрашена цветом functional-tram на 28 %.
            .background(if (pressed || active) lerp(background, colors.functionalTram, 0.28f) else background, AppTheme.shapes.pill)
            .then(if (danger) Modifier else Modifier.border(1.dp, colors.functionalTram.copy(alpha = 0.4f), AppTheme.shapes.pill))
            .clickable(interaction, indication = null, enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(pillPadding()),
        horizontalArrangement = pillArrangement(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) TablerIcon(icon, null, Modifier.size(20.dp), tint = if (danger) content else iconTint ?: colors.textPrimary)
        PillLabel(text, content)
        trailing?.invoke()
    }
}

private val DANGER = androidx.compose.ui.graphics.Color(0xFFD63C3C)

/** Кнопка стоит в PillGrid: растягивается на свою колонку, подпись по центру с многоточием. */
val LocalPillInGrid = androidx.compose.runtime.compositionLocalOf { false }

/** Раскладка кнопки-таблетки в сетке и вне её (PillButtonGrid сайта). */
@Composable
fun Modifier.pillWidth(): Modifier = if (LocalPillInGrid.current) fillMaxWidth().fillMaxHeight() else this

@Composable
fun pillPadding() = if (LocalPillInGrid.current) PaddingValues(horizontal = 8.dp) else PaddingValues(start = 12.dp, end = 14.dp)

@Composable
fun pillArrangement() = if (LocalPillInGrid.current) Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally) else Arrangement.spacedBy(6.dp)

/** Подпись кнопки: в сетке не шире колонки - обрезается многоточием. */
@Composable
fun RowScope.PillLabel(text: String, color: androidx.compose.ui.graphics.Color) {
    Text(
        text, Modifier.weight(1f, fill = false),
        style = AppTheme.type.button, color = color, maxLines = 1,
        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
    )
}

class PillGridScope {
    internal val cells = mutableListOf<Pair<String?, (@Composable () -> Unit)?>>()

    /** Подпись во всю строку («Построить маршрут»); в счёт кнопок не входит. */
    fun caption(text: String) { cells += text to null }

    fun button(content: @Composable () -> Unit) { cells += null to content }
}

/**
 * Сетка кнопок в карточках (PillButtonGrid сайта): две равные колонки, сетка всегда законченная -
 * нечётная последняя кнопка растягивается на всю строку. Подписи - во всю строку.
 */
@Composable
fun PillGrid(modifier: Modifier = Modifier, content: PillGridScope.() -> Unit) {
    val cells = PillGridScope().apply(content).cells
    val totalButtons = cells.count { it.second != null }
    androidx.compose.foundation.layout.Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        var seen = 0
        var i = 0
        while (i < cells.size) {
            val (caption, button) = cells[i]
            if (caption != null) {
                Text(caption, style = AppTheme.type.small, color = AppTheme.colors.textSecondary)
                i++
                continue
            }
            val next = cells.getOrNull(i + 1)?.second
            // Пара - если следующая тоже кнопка; нечётная последняя - на всю строку.
            val pair = next != null && seen + 1 < totalButtons
            androidx.compose.runtime.CompositionLocalProvider(LocalPillInGrid provides true) {
                Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(Modifier.weight(1f).fillMaxHeight()) { button!!() }
                    if (pair) Box(Modifier.weight(1f).fillMaxHeight()) { next!!() }
                }
            }
            seen += if (pair) 2 else 1
            i += if (pair) 2 else 1
        }
    }
}

/** Кнопка чуть проседает при нажатии и плавно возвращается (как :active на сайте). */
@Composable
fun pressScale(pressed: Boolean, to: Float): Float {
    val reduce = ru.khudob1n.krasnodar.transport.settings.LocalMapPreferences.current.reduceMotion
    val scale by androidx.compose.animation.core.animateFloatAsState(
        if (pressed) to else 1f,
        if (reduce) androidx.compose.animation.core.snap() else androidx.compose.animation.core.tween(120),
        label = "press",
    )
    return scale
}
