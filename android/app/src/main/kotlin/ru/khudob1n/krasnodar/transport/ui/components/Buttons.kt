package ru.khudob1n.krasnodar.transport.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
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
    icon: Int,
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
            .scale(if (pressed) 0.94f else 1f)
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
    icon: Int? = null,
    iconTint: androidx.compose.ui.graphics.Color? = null,
    enabled: Boolean = true,
    danger: Boolean = false,
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val colors = AppTheme.colors
    val background = if (danger) DANGER else colors.backgroundSecondary
    val content = if (danger) androidx.compose.ui.graphics.Color.White else colors.textPrimary
    Row(
        modifier
            .alpha(if (enabled) 1f else 0.45f)
            .scale(if (pressed) 0.97f else 1f)
            .heightIn(min = 38.dp)
            .background(if (pressed) lerp(background, colors.functionalTram, 0.28f) else background, AppTheme.shapes.pill)
            .then(if (danger) Modifier else Modifier.border(1.dp, colors.functionalTram.copy(alpha = 0.4f), AppTheme.shapes.pill))
            .clickable(interaction, indication = null, enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(start = 12.dp, end = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) TablerIcon(icon, null, Modifier.size(20.dp), tint = if (danger) content else iconTint ?: colors.textPrimary)
        Text(text, style = AppTheme.type.button, color = content, maxLines = 1)
    }
}

private val DANGER = androidx.compose.ui.graphics.Color(0xFFD63C3C)
