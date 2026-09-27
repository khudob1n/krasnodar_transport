package ru.khudob1n.krasnodar.transport.map

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import androidx.core.content.ContextCompat
import androidx.core.content.res.ResourcesCompat
import androidx.core.graphics.createBitmap
import androidx.core.graphics.withClip
import androidx.core.graphics.withTranslation
import com.caverock.androidsvg.RenderOptions
import com.caverock.androidsvg.SVG
import ru.khudob1n.krasnodar.transport.R
import ru.khudob1n.krasnodar.transport.ui.components.TransportType
import ru.khudob1n.krasnodar.transport.ui.theme.AppColors
import ru.khudob1n.krasnodar.transport.ui.theme.DarkColors
import ru.khudob1n.krasnodar.transport.ui.theme.LightColors
import kotlin.math.max
import kotlin.math.roundToInt

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

/**
 * Картинки для слоёв карты - повторяют маркеры сайта (components/Map/Vehicles/Marker,
 * components/Map/Stops/Item). Размеры в CSS-пикселях сайта, здесь - в dp.
 */
class MarkerRenderer(private val context: Context) {
    private companion object { val assetCache = HashMap<String, String>() }
    private val density = context.resources.displayMetrics.density
    private fun dp(value: Float) = value * density

    private fun colorsOf(dark: Boolean): AppColors = if (dark) DarkColors else LightColors
    private fun AppColors.hex(type: TransportType) = String.format("#%06X", colorInt(type) and 0xFFFFFF)
    private fun AppColors.colorInt(type: TransportType): Int = when (type) {
        TransportType.Bus -> bus.argb()
        TransportType.Troll -> troll.argb()
        TransportType.Tram -> tram.argb()
    }

    private fun androidx.compose.ui.graphics.Color.argb(): Int = android.graphics.Color.argb(
        (alpha * 255).roundToInt(), (red * 255).roundToInt(), (green * 255).roundToInt(), (blue * 255).roundToInt(),
    )

    private val onest: Typeface = ResourcesCompat.getFont(context, R.font.onest) ?: Typeface.DEFAULT

    /** Текст SVG из assets - читаем один раз: маркеры рисуются сотнями. */
    private fun asset(path: String): String = synchronized(assetCache) {
        assetCache.getOrPut(path) { context.assets.open(path).bufferedReader().use { it.readText() } }
    }

    private fun svg(path: String, css: String? = null, vars: Map<String, String> = emptyMap()): Pair<SVG, RenderOptions?> {
        var text = asset(path)
        // AndroidSVG не знает CSS-переменных: подставляем значения темы, как их видит браузер.
        for ((name, value) in vars) text = text.replace("var(--$name)", value)
        return SVG.getFromString(text) to css?.let { RenderOptions().css(it) }
    }

    private fun Canvas.drawSvg(path: String, rect: RectF, css: String? = null, vars: Map<String, String> = emptyMap()) {
        val (svg, options) = svg(path, css, vars)
        // У SVG с width/height (капля 40x48, значки доступности) AndroidSVG рисует документ в его
        // собственном размере, а не во всю область - растягиваем на 100%, как img в вёрстке сайта.
        svg.setDocumentWidth("100%")
        svg.setDocumentHeight("100%")
        val opts = (options ?: RenderOptions()).viewPort(rect.left, rect.top, rect.width(), rect.height())
        svg.renderToCanvas(this, opts)
    }

    // ---------------- Остановки ----------------

    /** Белый кружок 24 с тонкой рамкой и тенью, внутри пиктограмма Temaki 15 цвета транспорта. */
    fun stop(kind: StopKind, dark: Boolean): Bitmap {
        val colors = colorsOf(dark)
        val pad = dp(3f)
        val size = dp(24f)
        val bitmap = createBitmap((size + 2 * pad).roundToInt(), (size + 2 * pad).roundToInt())
        val canvas = Canvas(bitmap)
        val c = pad + size / 2
        val radius = size / 2 - dp(0.5f)
        canvas.drawCircle(c, c + dp(1f), radius, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb(41, 0, 0, 0)
            maskFilter = BlurMaskFilter(dp(1.5f), BlurMaskFilter.Blur.NORMAL)
        })
        canvas.drawCircle(c, c, radius, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = colors.backgroundPrimary.argb() })
        canvas.drawCircle(c, c, radius, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE; strokeWidth = dp(1f); color = Color.rgb(0xE6, 0xE4, 0xE0)
        })
        val icon = dp(15f)
        val rect = RectF(c - icon / 2, c - icon / 2, c + icon / 2, c + icon / 2)
        fun board(type: TransportType) = if (type == TransportType.Tram) "temaki/board_tram.svg" else "temaki/board_bus.svg"
        when (kind) {
            StopKind.TrollBus -> {
                // Совмещённая: значок делится по диагонали - левая верхняя половина цвета
                // автобуса, правая нижняя - троллейбуса (TransportIcon на сайте).
                val upper = Path().apply { moveTo(rect.left, rect.top); lineTo(rect.right, rect.top); lineTo(rect.left, rect.bottom); close() }
                val lower = Path().apply { moveTo(rect.right, rect.top); lineTo(rect.right, rect.bottom); lineTo(rect.left, rect.bottom); close() }
                canvas.withClip(upper) { drawSvg(board(TransportType.Bus), rect, "path{fill:${colors.hex(TransportType.Bus)}}") }
                canvas.withClip(lower) { drawSvg(board(TransportType.Troll), rect, "path{fill:${colors.hex(TransportType.Troll)}}") }
            }
            else -> {
                val type = when (kind) { StopKind.Tram -> TransportType.Tram; StopKind.Troll -> TransportType.Troll; else -> TransportType.Bus }
                canvas.drawSvg(board(type), rect, "path{fill:${colors.hex(type)}}")
            }
        }
        return bitmap
    }

    /**
     * Подпись объекта на карте (MapStopsItemLabel сайта): Onest 13/500 цвета текста, без
     * подложки, с обводкой 2 цветом фона темы - так она читается на пёстрой карте.
     */
    fun label(text: String, dark: Boolean, maxWidthDp: Float? = null): Bitmap {
        val colors = colorsOf(dark)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = onest
            fontVariationSettings = "'wght' 500"
            textSize = dp(13f)
        }
        val halo = dp(2f)
        val fm = paint.fontMetrics
        val lineHeight = dp(16f)
        // Перенос по словам в пределах maxWidth, строки по центру - подпись депо (MapDepotLabel).
        val lines = if (maxWidthDp == null) listOf(text) else buildList {
            var line = ""
            for (word in text.split(' ')) {
                val candidate = if (line.isEmpty()) word else "$line $word"
                if (line.isNotEmpty() && paint.measureText(candidate) > dp(maxWidthDp)) { add(line); line = word } else line = candidate
            }
            if (line.isNotEmpty()) add(line)
        }
        val textWidth = lines.maxOf { paint.measureText(it) }
        val width = (textWidth + 2 * halo + dp(2f)).roundToInt()
        val height = ((lines.size - 1) * lineHeight + fm.descent - fm.ascent + 2 * halo).roundToInt()
        val bitmap = createBitmap(width, height)
        val canvas = Canvas(bitmap)
        for ((index, line) in lines.withIndex()) {
            val x = if (maxWidthDp == null) halo + dp(1f) else (width - paint.measureText(line)) / 2
            val baseline = halo - fm.ascent + index * lineHeight
            paint.style = Paint.Style.STROKE
            paint.strokeWidth = halo * 2
            paint.strokeJoin = Paint.Join.ROUND
            paint.color = colors.backgroundPrimary.argb()
            canvas.drawText(line, x, baseline, paint)
            paint.style = Paint.Style.FILL
            paint.color = colors.textPrimary.argb()
            canvas.drawText(line, x, baseline, paint)
        }
        return bitmap
    }

    /**
     * Вокзал, автовокзал, аэропорт (RailStationItem сайта): кружок 22 с рамкой и тенью, внутри
     * пиктограмма Temaki 14 цвета вида объекта.
     */
    fun station(kind: String, dark: Boolean): Bitmap {
        val colors = colorsOf(dark)
        val pad = dp(3f)
        val size = dp(22f)
        val bitmap = createBitmap((size + 2 * pad).roundToInt(), (size + 2 * pad).roundToInt())
        val canvas = Canvas(bitmap)
        val c = pad + size / 2
        val radius = size / 2 - dp(0.5f)
        canvas.drawCircle(c, c + dp(1f), radius, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb(51, 0, 0, 0); maskFilter = BlurMaskFilter(dp(2f), BlurMaskFilter.Blur.NORMAL)
        })
        canvas.drawCircle(c, c, radius, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = colors.backgroundPrimary.argb() })
        canvas.drawCircle(c, c, radius, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE; strokeWidth = dp(1f); color = Color.rgb(0xE6, 0xE4, 0xE0)
        })
        val icon = dp(14f)
        canvas.drawSvg(stationIconPath(kind), RectF(c - icon / 2, c - icon / 2, c + icon / 2, c + icon / 2), "path{fill:${stationColorHex(kind, colors)}}")
        return bitmap
    }

    /** Пиктограмма объекта крупно, для шапки карточки вокзала. */
    fun stationIcon(kind: String, sizePx: Int, dark: Boolean): Bitmap {
        val bitmap = createBitmap(sizePx, sizePx)
        Canvas(bitmap).drawSvg(stationIconPath(kind), RectF(0f, 0f, sizePx.toFloat(), sizePx.toFloat()), "path{fill:${stationColorHex(kind, colorsOf(dark))}}")
        return bitmap
    }

    private fun stationIconPath(kind: String) = when (kind) {
        "bus_terminal" -> "temaki/board_bus.svg"
        "airport" -> "temaki/airport.svg"
        else -> "temaki/board_train_diesel.svg"
    }

    /** STATION_KIND_COLORS сайта. */
    private fun stationColorHex(kind: String, colors: AppColors) = String.format("#%06X", stationColorInt(kind, colors) and 0xFFFFFF)

    fun stationColorInt(kind: String, colors: AppColors = LightColors): Int = when (kind) {
        "bus_terminal" -> colors.busTerminal.argb()
        "airport" -> colors.airport.argb()
        else -> colors.train.argb()
    }

    /** Пиктограмма вида остановки без кружка - для шапки карточки остановки (37 у сайта). */
    fun stopTypeIcon(kind: StopKind, sizePx: Int, dark: Boolean): Bitmap {
        val colors = colorsOf(dark)
        val bitmap = createBitmap(sizePx, sizePx)
        val canvas = Canvas(bitmap)
        val rect = RectF(0f, 0f, sizePx.toFloat(), sizePx.toFloat())
        fun board(type: TransportType) = if (type == TransportType.Tram) "temaki/board_tram.svg" else "temaki/board_bus.svg"
        if (kind == StopKind.TrollBus) {
            val upper = Path().apply { moveTo(0f, 0f); lineTo(rect.right, 0f); lineTo(0f, rect.bottom); close() }
            val lower = Path().apply { moveTo(rect.right, 0f); lineTo(rect.right, rect.bottom); lineTo(0f, rect.bottom); close() }
            canvas.withClip(upper) { drawSvg(board(TransportType.Bus), rect, "path{fill:${colors.hex(TransportType.Bus)}}") }
            canvas.withClip(lower) { drawSvg(board(TransportType.Troll), rect, "path{fill:${colors.hex(TransportType.Troll)}}") }
        } else {
            val type = when (kind) { StopKind.Tram -> TransportType.Tram; StopKind.Troll -> TransportType.Troll; else -> TransportType.Bus }
            canvas.drawSvg(board(type), rect, "path{fill:${colors.hex(type)}}")
        }
        return bitmap
    }

    /** Пиктограмма транспорта Temaki цвета вида - для шапки карточки машины. */
    fun transportIcon(type: TransportType, widthPx: Int, dark: Boolean): Bitmap {
        val colors = colorsOf(dark)
        val heightPx = (widthPx * 27f / 24f).roundToInt()
        val bitmap = createBitmap(widthPx, heightPx)
        val name = when (type) { TransportType.Bus -> "bus"; TransportType.Troll -> "trolleybus"; TransportType.Tram -> "tram" }
        Canvas(bitmap).drawSvg("temaki/$name.svg", RectF(0f, 0f, widthPx.toFloat(), heightPx.toFloat()), "path{fill:${colors.hex(type)}}")
        return bitmap
    }

    /** Метка «я здесь» - public/icons/user-placemark.svg сайта, 58x60. */
    fun userPlacemark(): Bitmap {
        val bitmap = createBitmap(dp(58f).roundToInt(), dp(60f).roundToInt())
        Canvas(bitmap).drawSvg("icons/user-placemark.svg", RectF(0f, 0f, dp(58f), dp(60f)))
        return bitmap
    }

    /** Метка A или B маршрута: цветной кружок с буквой и белой обводкой (JourneyFieldMarker сайта). */
    fun journeyMarker(letter: String): Bitmap {
        val size = dp(30f)
        val bitmap = createBitmap(size.roundToInt(), size.roundToInt())
        val canvas = Canvas(bitmap)
        val c = size / 2
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        paint.color = android.graphics.Color.WHITE
        canvas.drawCircle(c, c, c, paint)
        paint.color = if (letter == "A") 0xFF2E7D32.toInt() else 0xFFD32F2F.toInt()
        canvas.drawCircle(c, c, c - dp(2.5f), paint)
        paint.color = android.graphics.Color.WHITE
        paint.typeface = onest
        paint.fontVariationSettings = "'wght' 700"
        paint.textSize = dp(14f)
        paint.textAlign = Paint.Align.CENTER
        canvas.drawText(letter, c, c - (paint.descent() + paint.ascent()) / 2, paint)
        return bitmap
    }

    // ---------------- Машины ----------------

    /**
     * «Капля» со стрелкой курса (public/icons/{bus,tram,troll}-arrow.svg, 40x48). Центр круглой
     * части капли - (20, 28); картинка дополнена до квадрата с этим центром посередине, чтобы
     * MapLibre поворачивал её вокруг центра (icon-rotate). stale - штриховка цвета транспорта.
     */
    fun arrow(type: TransportType, stale: Boolean, dark: Boolean): Bitmap {
        val colors = colorsOf(dark)
        val side = dp(56f)
        val bitmap = createBitmap(side.roundToInt(), side.roundToInt())
        val canvas = Canvas(bitmap)
        val rect = RectF(dp(8f), 0f, dp(48f), dp(48f)) // (20, 28) капли -> (28, 28) квадрата
        val name = when (type) { TransportType.Bus -> "bus"; TransportType.Troll -> "troll"; TransportType.Tram -> "tram" }
        val vars = mapOf(
            "background-primary" to String.format("#%06X", colors.backgroundPrimary.argb() and 0xFFFFFF),
            name to colors.hex(type),
        )
        if (!stale) {
            canvas.drawSvg("icons/$name-arrow.svg", rect, vars = vars)
        } else {
            // Вся капля по контуру - узор StaleHatchPattern сайта: косые полосы цвета транспорта
            // (0.35) по фону карточки, непрозрачно - наложенные машины не просвечивают. Период 12
            // в координатах пути капли (он уменьшен в 0.465 раза) - полосы через ~5.6 dp.
            val svg = asset("icons/$name-arrow.svg")
                .replace("var(--$name)", colors.hex(type))
                .replaceFirst("fill=\"var(--background-primary)\"", "fill=\"url(#hatch)\"")
                .replaceFirst(
                    "<g ",
                    "<defs><pattern id=\"hatch\" width=\"12\" height=\"12\" patternUnits=\"userSpaceOnUse\" patternTransform=\"rotate(45)\">" +
                        "<rect width=\"12\" height=\"12\" fill=\"${String.format("#%06X", colors.backgroundPrimary.argb() and 0xFFFFFF)}\"/>" +
                        "<rect width=\"5\" height=\"12\" fill=\"${colors.hex(type)}\" fill-opacity=\"0.35\"/></pattern></defs><g ",
                )
            val doc = SVG.getFromString(svg)
            doc.setDocumentWidth("100%")
            doc.setDocumentHeight("100%")
            doc.renderToCanvas(canvas, RenderOptions().viewPort(rect.left, rect.top, rect.width(), rect.height()))
        }
        return bitmap
    }

    /**
     * Пиктограмма транспорта и бейджи (номер, низкий пол или предупреждение). Бейджи справа от
     * капли, при курсе на восток - слева (EAST_COURSE_RANGE сайта). Картинка симметрична
     * относительно центра капли, чтобы ставить её с icon-anchor center.
     */
    fun body(type: TransportType, number: String, east: Boolean, lowFloor: Boolean, warning: Boolean, stale: Boolean, dark: Boolean): Bitmap {
        val colors = colorsOf(dark)
        val color = colors.colorInt(type)
        val badgeH = dp(24f)
        val ring = dp(2.5f)
        val gap = dp(9f)
        val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = onest
            fontVariationSettings = "'wght' 500"
            textSize = dp(21f)
            this.color = color
        }
        val numberW = max(dp(42f), textPaint.measureText(number) + dp(8f))
        val extraW = if (lowFloor || warning) gap + badgeH else 0f
        val badgesW = numberW + extraW
        val start = dp(32f) // от центра капли до бейджа: left 52 у сайта минус центр 20
        val half = start + badgesW + ring + dp(2f)
        val width = (half * 2).roundToInt()
        val height = dp(56f).roundToInt()
        val bitmap = createBitmap(width, height)
        val canvas = Canvas(bitmap)
        val cx = half
        val cy = dp(28f)

        // Пиктограмма Temaki 24x27 в центре капли.
        val iconName = when (type) { TransportType.Bus -> "bus"; TransportType.Troll -> "trolleybus"; TransportType.Tram -> "tram" }
        canvas.drawSvg("temaki/$iconName.svg", RectF(cx - dp(12f), cy - dp(13f), cx + dp(12f), cy + dp(14f)), "path{fill:${colors.hex(type)}}")

        // Бейджи: белые (фон карточки в тёмной теме) со скруглением 8 и кольцом 2.5 цвета транспорта.
        val top = cy - dp(14f)
        val bg = colors.backgroundPrimary.argb()
        fun badge(left: Float, w: Float): RectF {
            val r = RectF(left, top, left + w, top + badgeH)
            canvas.drawRoundRect(RectF(r.left - ring, r.top - ring, r.right + ring, r.bottom + ring), dp(8f) + ring, dp(8f) + ring, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color })
            canvas.drawRoundRect(r, dp(8f), dp(8f), Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = bg })
            if (stale) canvas.withClip(r) {
                val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color; alpha = 90; strokeWidth = dp(2.5f) }
                var x = r.left - badgeH
                while (x < r.right) { drawLine(x, r.bottom, x + badgeH, r.top, p); x += dp(5.5f) }
            }
            return r
        }
        val order = if (east) listOf("extra", "number") else listOf("number", "extra")
        var x = if (east) cx - start - badgesW else cx + start
        for (item in order) {
            if (item == "number") {
                val r = badge(x, numberW)
                val fm = textPaint.fontMetrics
                val baseline = r.centerY() - (fm.ascent + fm.descent) / 2
                canvas.drawText(number, r.centerX() - textPaint.measureText(number) / 2, baseline, textPaint)
                x += numberW + gap
            } else if (lowFloor || warning) {
                val r = badge(x, badgeH)
                if (warning) {
                    ContextCompat.getDrawable(context, R.drawable.tabler_alert_triangle)?.apply {
                        setTint(Color.rgb(0xE0, 0x9B, 0x00))
                        setBounds((r.left + dp(3f)).roundToInt(), (r.top + dp(3f)).roundToInt(), (r.right - dp(3f)).roundToInt(), (r.bottom - dp(3f)).roundToInt())
                        draw(canvas)
                    }
                } else {
                    val name = when (type) { TransportType.Bus -> "bus"; TransportType.Troll -> "troll"; TransportType.Tram -> "tram" }
                    canvas.withTranslation { drawSvg("icons/$name-accessibility.svg", RectF(r.left + dp(5f), r.top + dp(3f), r.right - dp(5f), r.bottom - dp(3f))) }
                }
                x += badgeH + gap
            }
        }
        return bitmap
    }
}
