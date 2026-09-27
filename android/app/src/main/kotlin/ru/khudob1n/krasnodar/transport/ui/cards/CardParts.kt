package ru.khudob1n.krasnodar.transport.ui.cards

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material3.HorizontalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import ru.khudob1n.krasnodar.transport.map.MarkerRenderer
import ru.khudob1n.krasnodar.transport.map.StopKind
import ru.khudob1n.krasnodar.transport.ui.components.TransportType
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme

@Composable
fun CardDivider() = HorizontalDivider(Modifier.fillMaxWidth(), color = AppTheme.colors.backgroundSecondary)

@Composable
fun StopKindIcon(kind: StopKind, size: Dp) {
    val context = LocalContext.current
    val dark = AppTheme.colors.isDark
    val px = with(LocalDensity.current) { size.roundToPx() }
    val bitmap = remember(kind, px, dark) { MarkerRenderer(context).stopTypeIcon(kind, px, dark).asImageBitmap() }
    Image(bitmap, null, Modifier.size(size))
}

@Composable
fun TransportTypeIcon(type: TransportType, width: Dp) {
    val context = LocalContext.current
    val dark = AppTheme.colors.isDark
    val px = with(LocalDensity.current) { width.roundToPx() }
    val bitmap = remember(type, px, dark) { MarkerRenderer(context).transportIcon(type, px, dark).asImageBitmap() }
    Image(bitmap, null, Modifier.size(width, width * 27f / 24f).height(width * 27f / 24f))
}
