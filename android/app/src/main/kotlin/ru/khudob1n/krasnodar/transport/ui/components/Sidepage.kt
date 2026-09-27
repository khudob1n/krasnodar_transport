package ru.khudob1n.krasnodar.transport.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import ru.khudob1n.krasnodar.transport.R
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme

/**
 * Карточка, выезжающая снизу поверх карты (components/UI/Sidepage на мобильной ширине):
 * скругление 24, «ручка» сверху, крестик закрытия справа.
 */
@Composable
fun Sidepage(onClose: (() -> Unit)?, modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    val colors = AppTheme.colors
    Box(
        modifier
            .fillMaxWidth()
            .shadow(16.dp, AppTheme.shapes.sidepage)
            .background(colors.backgroundPrimary, AppTheme.shapes.sidepage)
            // Касания по пустым местам карточки не уходят на карту под ней.
            .pointerInput(Unit) { awaitPointerEventScope { while (true) awaitPointerEvent() } },
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
