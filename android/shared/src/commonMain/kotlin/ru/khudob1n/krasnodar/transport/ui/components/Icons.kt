package ru.khudob1n.krasnodar.transport.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import ru.khudob1n.krasnodar.transport.assets.WebAssets
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme

/**
 * Иконка Tabler - те же, что на сайте (Tabler.* генерирует задача generateWebAssets из
 * node_modules сайта). Цвет по умолчанию - цвет текста, как currentColor. Размер - 24, если
 * modifier не задал свой.
 */
@Composable
fun TablerIcon(icon: SvgIcon, contentDescription: String?, modifier: Modifier = Modifier, tint: Color = AppTheme.colors.textPrimary) {
    Canvas(
        modifier
            .then(if (contentDescription != null) Modifier.semantics { this.contentDescription = contentDescription; role = Role.Image } else Modifier)
            .size(DefaultIconSize),
    ) { drawSvg(icon, color = tint) }
}

/** Значки сайта (SVG из public/icons). tint - перекрасить одноцветный значок (как CSS filter на сайте). */
@Composable
fun SiteIcon(name: String, width: Dp, contentDescription: String?, modifier: Modifier = Modifier, tint: Color? = null) {
    val icon = WebAssets.icons[name] ?: return
    SvgImage(icon, width, contentDescription, modifier, tint)
}

val DefaultIconSize = 24.dp
