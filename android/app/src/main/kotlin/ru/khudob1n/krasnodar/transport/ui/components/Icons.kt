package ru.khudob1n.krasnodar.transport.ui.components

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import androidx.compose.foundation.Image
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.caverock.androidsvg.SVG
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme
import kotlin.math.roundToInt

/**
 * Иконка Tabler - те же, что на сайте (R.drawable.tabler_* генерирует задача
 * generateTablerIcons из node_modules сайта). Цвет по умолчанию - цвет текста, как currentColor.
 */
@Composable
fun TablerIcon(res: Int, contentDescription: String?, modifier: Modifier = Modifier, tint: Color = AppTheme.colors.textPrimary) {
    Icon(painterResource(res), contentDescription, modifier, tint)
}

/** Значки сайта (SVG из public/icons, лежат в assets/icons) - растровые, для карты и Compose. */
object SiteIcons {
    private val cache = HashMap<String, Bitmap>()

    /** name - имя файла без .svg, например "bus-stop"; sizePx - ширина, высота по пропорциям. */
    fun bitmap(context: Context, name: String, widthPx: Int): Bitmap = synchronized(cache) {
        cache.getOrPut("$name@$widthPx") {
            val svg = context.assets.open("icons/$name.svg").use { SVG.getFromInputStream(it) }
            val ratio = if (svg.documentWidth > 0) svg.documentHeight / svg.documentWidth else 1f
            val heightPx = (widthPx * ratio).roundToInt().coerceAtLeast(1)
            svg.setDocumentWidth(widthPx.toFloat())
            svg.setDocumentHeight(heightPx.toFloat())
            Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888).also { svg.renderToCanvas(Canvas(it)) }
        }
    }
}

/** tint - перекрасить одноцветный значок (как CSS filter на сайте), например в цвет текста. */
@Composable
fun SiteIcon(name: String, width: Dp, contentDescription: String?, modifier: Modifier = Modifier, tint: Color? = null) {
    val context = LocalContext.current
    val px = with(LocalDensity.current) { width.roundToPx() }
    val image: ImageBitmap = remember(name, px) { SiteIcons.bitmap(context, name, px).asImageBitmap() }
    Image(image, contentDescription, modifier, colorFilter = tint?.let { ColorFilter.tint(it) })
}

val DefaultIconSize = 24.dp
