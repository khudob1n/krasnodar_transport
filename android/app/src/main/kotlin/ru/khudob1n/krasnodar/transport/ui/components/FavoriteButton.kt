package ru.khudob1n.krasnodar.transport.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import ru.khudob1n.krasnodar.transport.R
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme

/**
 * «В избранное» (components/UI/FavoriteButton сайта): кнопка с подписью, а не голая звезда.
 * Сохранено - звезда залита оранжевым, фон подкрашен им же, подпись основного цвета.
 * subject - «остановку» или «маршрут», для TalkBack.
 */
@Composable
fun FavoriteButton(active: Boolean, subject: String, onToggle: () -> Unit, modifier: Modifier = Modifier) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val colors = AppTheme.colors
    val accent = colors.tram
    val background = if (active) accent.copy(alpha = if (pressed) 0.22f else 0.14f).compositeOver(colors.backgroundPrimary) else colors.backgroundSecondary
    val border = if (active) accent.copy(alpha = 0.45f) else colors.functionalTram.copy(alpha = 0.4f)
    Row(
        modifier
            .scale(if (pressed) 0.97f else 1f)
            .heightIn(min = 38.dp)
            .background(background, AppTheme.shapes.pill)
            .border(1.dp, border, AppTheme.shapes.pill)
            .clickable(interaction, indication = null, role = Role.Switch, onClick = onToggle)
            .semantics {
                contentDescription = if (active) "Убрать $subject из избранного" else "Сохранить $subject в избранное"
                stateDescription = if (active) "В избранном" else "Не в избранном"
            }
            .padding(start = 12.dp, end = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (active) TablerIcon(R.drawable.tabler_star_filled, null, Modifier.size(20.dp), tint = accent)
        else SiteIcon("star", 20.dp, null, tint = colors.textPrimary)
        Text(if (active) "В избранном" else "В избранное", style = AppTheme.type.button, color = colors.textPrimary, maxLines = 1)
    }
}
