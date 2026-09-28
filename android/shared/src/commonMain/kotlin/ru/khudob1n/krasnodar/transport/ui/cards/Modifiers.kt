package ru.khudob1n.krasnodar.transport.ui.cards

import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.selection.selectable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription

/**
 * Нажатие без ripple - как кнопки сайта, у которых отклик - масштаб или цвет, а не волна.
 * role - что это для TalkBack («кнопка» по умолчанию).
 */
fun Modifier.clickableNoIndication(role: Role? = Role.Button, onClick: () -> Unit): Modifier = composed {
    clickable(remember { MutableInteractionSource() }, indication = null, role = role, onClick = onClick)
}

/** Вариант в полосе выбора (дни, будни/выходные): TalkBack читает «вкладка, выбрано». */
fun Modifier.selectableNoIndication(selected: Boolean, onClick: () -> Unit): Modifier = composed {
    selectable(selected, remember { MutableInteractionSource() }, indication = null, role = Role.Tab, onClick = onClick)
}

/** Строка, которая разворачивает список: TalkBack читает «развёрнуто» / «свёрнуто». */
fun Modifier.expandState(opened: Boolean): Modifier = semantics { stateDescription = if (opened) "Развёрнуто" else "Свёрнуто" }
