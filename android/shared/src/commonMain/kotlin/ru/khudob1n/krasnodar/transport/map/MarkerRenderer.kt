package ru.khudob1n.krasnodar.transport.map

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Canvas
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.CanvasDrawScope
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.sp
import ru.khudob1n.krasnodar.transport.assets.Tabler
import ru.khudob1n.krasnodar.transport.assets.WebAssets
import ru.khudob1n.krasnodar.transport.ui.components.SvgIcon
import ru.khudob1n.krasnodar.transport.ui.components.TransportType
import ru.khudob1n.krasnodar.transport.ui.components.drawSvg
import ru.khudob1n.krasnodar.transport.ui.theme.AppColors
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme
import ru.khudob1n.krasnodar.transport.ui.theme.AppTypography
import ru.khudob1n.krasnodar.transport.ui.theme.DarkColors
import ru.khudob1n.krasnodar.transport.ui.theme.LightColors
import kotlin.math.ceil
import kotlin.math.max

/** Вид остановки - stopTypeOf на сайте: автобус и троллейбус вместе - совмещённая. */
enum class StopKind(val id: String) { Bus("bus"), Tram("tram"), Troll("troll"), TrollBus("troll-bus") }

fun stopKindOf(types: Set<TransportType>?): StopKind {
    val set = types.orEmpty()
    return when {
        TransportType.Bus in set && TransportType.Troll in set -> StopKind.TrollBus
        TransportType.Tram in set -> StopKind.Tram
        TransportType.Troll in set -> StopKind.Troll
        else -> StopKind.Bus
    }
}

@Composable
fun rememberMarkerRenderer(): MarkerRenderer {
    val density = LocalDensity.current
    val measurer = rememberTextMeasurer()
    val type = AppTheme.type
    return remember(density, measurer, type) { MarkerRenderer(density, measurer, type) }
}

/**
 * Картинки маркеров - повторяют маркеры сайта (components/Map/Vehicles/Marker,
 * components/Map/Stops/Item). Размеры в CSS-пикселях сайта, здесь - в dp. Одинаково на Android и
 * iOS: рисует Compose (DrawScope), картинки для слоёв карты - ImageBitmap.
 */
class MarkerRenderer(private val density: Density, private val measurer: TextMeasurer, private val type: AppTypography) {
    private fun dp(value: Float) = value * density.density

    private fun colorsOf(dark: Boolean): AppColors = if (dark) DarkColors else LightColors

    private fun AppColors.of(type: TransportType): Color = when (type) {
        TransportType.Bus -> bus
        TransportType.Troll -> troll
        TransportType.Tram -> tram
    }

    /** Картинка w x h пикселей, нарисованная [block]. */
    fun bitmap(w: Float, h: Float, block: DrawScope.() -> Unit): ImageBitmap {
        val image = ImageBitmap(ceil(w).toInt().coerceAtLeast(1), ceil(h).toInt().coerceAtLeast(1))
        CanvasDrawScope().draw(density, LayoutDirection.Ltr, Canvas(image), Size(image.width.toFloat(), image.height.toFloat()), block)
        return image
    }

    /** Мягкая тень кружка (box-shadow сайта): несколько полупрозрачных кругов. */
    private fun DrawScope.circleShadow(center: Offset, radius: Float, alpha: Float, blur: Float) {
        for (i in 3 downTo 1) drawCircle(Color.Black.copy(alpha = alpha / 3), radius + blur * i / 3, center)
    }

    private fun board(type: TransportType) = if (type == TransportType.Tram) WebAssets.temaki.getValue("board_tram") else WebAssets.temaki.getValue("board_bus")

    // ---------------- Остановки ----------------

    /** Пиктограмма вида остановки в [rect]; совмещённая - по диагонали, автобус и троллейбус. */
    private fun DrawScope.stopPictogram(kind: StopKind, rect: Rect, colors: AppColors) {
        when (kind) {
            StopKind.TrollBus -> {
                // Левая верхняя половина цвета автобуса, правая нижняя - троллейбуса (TransportIcon на сайте).
                val upper = Path().apply { moveTo(rect.left, rect.top); lineTo(rect.right, rect.top); lineTo(rect.left, rect.bottom); close() }
                val lower = Path().apply { moveTo(rect.right, rect.top); lineTo(rect.right, rect.bottom); lineTo(rect.left, rect.bottom); close() }
                clipPath(upper) { drawSvg(board(TransportType.Bus), rect, fill = colors.bus) }
                clipPath(lower) { drawSvg(board(TransportType.Troll), rect, fill = colors.troll) }
            }
            else -> {
                val t = when (kind) { StopKind.Tram -> TransportType.Tram; StopKind.Troll -> TransportType.Troll; else -> TransportType.Bus }
                drawSvg(board(t), rect, fill = colors.of(t))
            }
        }
    }

    /** Белый кружок 24 с тонкой рамкой и тенью, внутри пиктограмма Temaki 15 цвета транспорта. */
    fun stop(kind: StopKind, dark: Boolean): ImageBitmap {
        val colors = colorsOf(dark)
        val pad = dp(3f)
        val size = dp(24f)
        return bitmap(size + 2 * pad, size + 2 * pad) {
            val c = Offset(pad + size / 2, pad + size / 2)
            val radius = size / 2 - dp(0.5f)
            circleShadow(c + Offset(0f, dp(1f)), radius - dp(1f), 0.16f, dp(1.5f))
            drawCircle(colors.backgroundPrimary, radius, c)
            drawCircle(Color(0xFFE6E4E0), radius, c, style = Stroke(dp(1f)))
            val icon = dp(15f)
            stopPictogram(kind, Rect(c.x - icon / 2, c.y - icon / 2, c.x + icon / 2, c.y + icon / 2), colors)
        }
    }

    /** Пиктограмма вида остановки без кружка - для шапки карточки остановки (37 у сайта). */
    fun stopTypeIcon(kind: StopKind, sizePx: Int, dark: Boolean): ImageBitmap =
        bitmap(sizePx.toFloat(), sizePx.toFloat()) { stopPictogram(kind, Rect(0f, 0f, size.width, size.height), colorsOf(dark)) }

    /**
     * Подпись объекта на карте (MapStopsItemLabel сайта): Onest 13/500 цвета текста, без
     * подложки, с обводкой 2 цветом фона темы - так она читается на пёстрой карте. maxWidthDp -
     * перенос по словам, строки по центру (подпись депо).
     */
    fun label(text: String, dark: Boolean, maxWidthDp: Float? = null): ImageBitmap {
        val colors = colorsOf(dark)
        val style = TextStyle(fontFamily = type.onest, fontWeight = FontWeight.Medium, fontSize = 13.sp, lineHeight = 16.sp, textAlign = if (maxWidthDp != null) TextAlign.Center else TextAlign.Start)
        val halo = dp(2f)
        val constraints = if (maxWidthDp != null) Constraints(maxWidth = dp(maxWidthDp).toInt()) else Constraints()
        val layout = measurer.measure(text, style, constraints = constraints, density = density)
        return bitmap(layout.size.width + 2 * halo + dp(2f), layout.size.height + 2 * halo) {
            val at = Offset(halo + dp(1f), halo)
            // Обводка - текст цветом фона, сдвинутый по кругу на её толщину (Stroke у текста
            // рисовался чёрным: раскладка из кэша TextMeasurer приходит с чужим стилем).
            for (i in 0 until 16) {
                val a = i * kotlin.math.PI / 8
                drawText(layout, color = colors.backgroundPrimary, topLeft = at + Offset((halo * kotlin.math.cos(a)).toFloat(), (halo * kotlin.math.sin(a)).toFloat()))
            }
            drawText(layout, color = colors.textPrimary, topLeft = at)
        }
    }

    /**
     * Вокзал, автовокзал, аэропорт (RailStationItem сайта): кружок 22 с рамкой и тенью, внутри
     * пиктограмма Temaki 14 цвета вида объекта.
     */
    fun station(kind: String, dark: Boolean): ImageBitmap {
        val colors = colorsOf(dark)
        val pad = dp(3f)
        val size = dp(22f)
        return bitmap(size + 2 * pad, size + 2 * pad) {
            val c = Offset(pad + size / 2, pad + size / 2)
            val radius = size / 2 - dp(0.5f)
            circleShadow(c + Offset(0f, dp(1f)), radius - dp(1f), 0.2f, dp(2f))
            drawCircle(colors.backgroundPrimary, radius, c)
            drawCircle(Color(0xFFE6E4E0), radius, c, style = Stroke(dp(1f)))
            val icon = dp(14f)
            drawSvg(stationIconOf(kind), Rect(c.x - icon / 2, c.y - icon / 2, c.x + icon / 2, c.y + icon / 2), fill = stationColor(kind, colors))
        }
    }

    /** Пиктограмма объекта крупно, для шапки карточки вокзала. */
    fun stationIcon(kind: String, sizePx: Int, dark: Boolean): ImageBitmap =
        bitmap(sizePx.toFloat(), sizePx.toFloat()) { drawSvg(stationIconOf(kind), fill = stationColor(kind, colorsOf(dark))) }

    private fun stationIconOf(kind: String): SvgIcon = WebAssets.temaki.getValue(
        when (kind) { "bus_terminal" -> "board_bus"; "airport" -> "airport"; else -> "board_train_diesel" },
    )

    /** STATION_KIND_COLORS сайта. */
    fun stationColor(kind: String, colors: AppColors = LightColors): Color = when (kind) {
        "bus_terminal" -> colors.busTerminal
        "airport" -> colors.airport
        else -> colors.train
    }

    /** Пиктограмма транспорта Temaki цвета вида - для шапки карточки машины. */
    fun transportIcon(type: TransportType, widthPx: Int, dark: Boolean): ImageBitmap =
        bitmap(widthPx.toFloat(), widthPx * 27f / 24f) { drawSvg(pictogramOf(type), fill = colorsOf(dark).of(type)) }

    private fun pictogramOf(type: TransportType) = WebAssets.temaki.getValue(
        when (type) { TransportType.Bus -> "bus"; TransportType.Troll -> "trolleybus"; TransportType.Tram -> "tram" },
    )

    /** Метка «я здесь» - public/icons/user-placemark.svg сайта, 58x60. */
    fun userPlacemark(): ImageBitmap = bitmap(dp(58f), dp(60f)) { drawSvg(WebAssets.icons.getValue("user-placemark")) }

    /** Метка A или B маршрута: цветной кружок с буквой и белой обводкой (JourneyFieldMarker сайта). */
    fun journeyMarker(letter: String): ImageBitmap {
        val size = dp(30f)
        val text = measurer.measure(letter, TextStyle(fontFamily = type.onest, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Color.White), density = density)
        return bitmap(size, size) {
            val c = Offset(size / 2, size / 2)
            drawCircle(Color.White, size / 2, c)
            drawCircle(if (letter == "A") Color(0xFF2E7D32) else Color(0xFFD32F2F), size / 2 - dp(2.5f), c)
            drawText(text, topLeft = Offset(c.x - text.size.width / 2f, c.y - text.size.height / 2f))
        }
    }

    // ---------------- Машины ----------------

    private fun arrowIcon(type: TransportType) = WebAssets.icons.getValue(
        when (type) { TransportType.Bus -> "bus-arrow"; TransportType.Troll -> "troll-arrow"; TransportType.Tram -> "tram-arrow" },
    )

    /**
     * «Капля» со стрелкой курса (public/icons/{bus,tram,troll}-arrow.svg, 40x48) с центром круглой
     * части (20, 28) в [center], повёрнутая на [course]. stale - вся капля заштрихована косыми
     * полосами цвета транспорта по фону (StaleHatchPattern сайта), непрозрачно.
     */
    fun DrawScope.drawArrow(center: Offset, course: Float, type: TransportType, stale: Boolean, dark: Boolean) {
        val colors = colorsOf(dark)
        val color = colors.of(type)
        val rect = Rect(center.x - dp(20f), center.y - dp(28f), center.x + dp(20f), center.y + dp(20f))
        rotate(course, center) {
            val vars = mapOf("background-primary" to colors.backgroundPrimary, "bus" to color, "troll" to color, "tram" to color)
            drawSvg(arrowIcon(type), rect, vars = vars, fillOverlay = if (!stale) null else { _ ->
                // Узор в координатах viewBox (40x48): период 5.6, полоса 2.3 - как pattern 12/5 в 0.465.
                val stripe = color.copy(alpha = 0.35f)
                var x = -48f
                while (x < 48f) {
                    val p = Path().apply { moveTo(x, 48f); lineTo(x + 2.3f * 1.41f, 48f); lineTo(x + 2.3f * 1.41f + 48f, 0f); lineTo(x + 48f, 0f); close() }
                    drawPath(p, stripe)
                    x += 5.6f * 1.41f
                }
            })
        }
    }

    /** Капля отдельной картинкой, 56x56 с центром круга посередине (легенда, карточка машины). */
    fun arrow(type: TransportType, stale: Boolean, dark: Boolean): ImageBitmap =
        bitmap(dp(56f), dp(56f)) { drawArrow(Offset(dp(28f), dp(28f)), 0f, type, stale, dark) }

    private val numberLayouts = HashMap<String, TextLayoutResult>()

    private fun numberLayout(number: String) = numberLayouts.getOrPut(number) {
        measurer.measure(number, TextStyle(fontFamily = type.onest, fontWeight = FontWeight.Medium, fontSize = 21.sp, lineHeight = 21.sp), density = density)
    }

    /** Ширина бейджей справа (слева) от капли - для размера картинки и зоны нажатия. */
    fun badgesWidth(number: String, extra: Boolean): Float =
        max(dp(42f), numberLayout(number).size.width + dp(8f)) + if (extra) dp(9f) + dp(24f) else 0f

    /** От центра капли до ближнего края бейджей: left 52 у сайта минус центр 20. */
    val badgesStart: Float get() = dp(32f)

    /**
     * Пиктограмма транспорта и бейджи (номер, низкий пол или предупреждение) вокруг центра капли.
     * Бейджи справа от капли, при курсе на восток - слева (EAST_COURSE_RANGE сайта).
     */
    fun DrawScope.drawBody(
        center: Offset, type: TransportType, number: String, east: Boolean,
        lowFloor: Boolean, warning: Boolean, stale: Boolean, dark: Boolean,
    ) {
        val colors = colorsOf(dark)
        val color = colors.of(type)
        val badgeH = dp(24f)
        val ring = dp(2.5f)
        val gap = dp(9f)
        val cx = center.x
        val cy = center.y

        // Пиктограмма Temaki 24x27 в центре капли.
        drawSvg(pictogramOf(type), Rect(cx - dp(12f), cy - dp(13f), cx + dp(12f), cy + dp(14f)), fill = color)

        // Бейджи: белые (фон карточки в тёмной теме) со скруглением 8 и кольцом 2.5 цвета транспорта.
        val top = cy - dp(14f)
        fun badge(left: Float, w: Float): Rect {
            drawRoundRect(color, Offset(left - ring, top - ring), Size(w + 2 * ring, badgeH + 2 * ring), CornerRadius(dp(8f) + ring))
            drawRoundRect(colors.backgroundPrimary, Offset(left, top), Size(w, badgeH), CornerRadius(dp(8f)))
            val r = Rect(left, top, left + w, top + badgeH)
            if (stale) clipRect(r.left, r.top, r.right, r.bottom) {
                var x = r.left - badgeH
                while (x < r.right) {
                    drawLine(color.copy(alpha = 90 / 255f), Offset(x, r.bottom), Offset(x + badgeH, r.top), strokeWidth = dp(2.5f))
                    x += dp(5.5f)
                }
            }
            return r
        }
        val layout = numberLayout(number)
        val numberW = max(dp(42f), layout.size.width + dp(8f))
        val extra = lowFloor || warning
        val badgesW = badgesWidth(number, extra)
        val order = if (east) listOf("extra", "number") else listOf("number", "extra")
        var x = if (east) cx - badgesStart - badgesW else cx + badgesStart
        for (item in order) {
            if (item == "number") {
                val r = badge(x, numberW)
                drawText(layout, color = color, topLeft = Offset(r.center.x - layout.size.width / 2f, r.center.y - layout.size.height / 2f))
                x += numberW + gap
            } else if (extra) {
                val r = badge(x, badgeH)
                if (warning) {
                    drawSvg(Tabler.alert_triangle, Rect(r.left + dp(3f), r.top + dp(3f), r.right - dp(3f), r.bottom - dp(3f)), color = Color(0xFFE09B00))
                } else {
                    val name = when (type) { TransportType.Bus -> "bus"; TransportType.Troll -> "troll"; TransportType.Tram -> "tram" }
                    drawSvg(WebAssets.icons.getValue("$name-accessibility"), Rect(r.left + dp(5f), r.top + dp(3f), r.right - dp(5f), r.bottom - dp(3f)))
                }
                x += badgeH + gap
            }
        }
    }

    /** Пиктограмма и бейджи картинкой, симметричной относительно центра капли (легенда). */
    fun body(type: TransportType, number: String, east: Boolean, lowFloor: Boolean, warning: Boolean, stale: Boolean, dark: Boolean): ImageBitmap {
        val half = badgesStart + badgesWidth(number, lowFloor || warning) + dp(2.5f) + dp(2f)
        return bitmap(half * 2, dp(56f)) { drawBody(Offset(half, dp(28f)), type, number, east, lowFloor, warning, stale, dark) }
    }
}
