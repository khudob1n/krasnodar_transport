package ru.khudob1n.krasnodar.transport.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.Matrix
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.isIdentity
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp

/**
 * SVG-значок сайта (public/icons, Temaki, Tabler), нарисованный общим кодом - одинаково на Android
 * и iOS. Понимает то, что встречается в этих файлах: path, circle, ellipse, rect, line, polyline,
 * polygon, группы с transform (translate, scale, matrix), fill/stroke/stroke-width/linecap/linejoin/
 * fill-rule, currentColor и var(--имя) - цвета темы подставляются при отрисовке.
 */
class SvgIcon(val id: String, private val source: String) {
    internal val doc: SvgDoc by lazy { SvgDoc.parse(source) }

    /** Ширина / высота по viewBox (или width/height документа). */
    val aspect: Float get() = doc.width / doc.height
}

internal class SvgShape(
    val path: Path,
    val fill: String?,
    val stroke: String?,
    val strokeWidth: Float,
    val cap: StrokeCap,
    val join: StrokeJoin,
)

internal class SvgDoc(val viewBox: Rect, val width: Float, val height: Float, val shapes: List<SvgShape>) {
    companion object {
        private val tagRe = Regex("""<(/?)([a-zA-Z]+)\b([^>]*?)(/?)>""")
        private val attrRe = Regex("""([a-zA-Z:-]+)\s*=\s*"([^"]*)"""")

        fun parse(svg: String): SvgDoc {
            var viewBox = Rect(0f, 0f, 24f, 24f)
            var width = 0f
            var height = 0f
            val shapes = ArrayList<SvgShape>()
            // Стек групп: унаследованные атрибуты и преобразование.
            val stack = ArrayList<Pair<Map<String, String>, Matrix>>()
            stack += emptyMap<String, String>() to Matrix()
            for (m in tagRe.findAll(svg.replace(Regex("<!--.*?-->", RegexOption.DOT_MATCHES_ALL), ""))) {
                val closing = m.groupValues[1] == "/"
                val name = m.groupValues[2]
                val selfClosing = m.groupValues[4] == "/"
                if (closing) {
                    if ((name == "g" || name == "svg") && stack.size > 1) stack.removeAt(stack.lastIndex)
                    continue
                }
                val own = attrRe.findAll(m.groupValues[3]).associate { it.groupValues[1] to it.groupValues[2] }
                val (inherited, parentMatrix) = stack.last()
                val attrs = inherited + own.filterKeys { it !in NOT_INHERITED }
                // У Compose точка - строка: p' = p·M. Сначала своё преобразование, потом родительское.
                val matrix = own["transform"]?.let { transformOf(it).also { mm -> mm.timesAssign(parentMatrix) } } ?: parentMatrix
                when (name) {
                    "svg" -> {
                        own["viewBox"]?.split(Regex("[\\s,]+"))?.mapNotNull { it.toFloatOrNull() }?.takeIf { it.size == 4 }?.let {
                            viewBox = Rect(it[0], it[1], it[0] + it[2], it[1] + it[3])
                        }
                        width = own["width"]?.removeSuffix("px")?.toFloatOrNull() ?: viewBox.width
                        height = own["height"]?.removeSuffix("px")?.toFloatOrNull() ?: viewBox.height
                        if (!selfClosing) stack += attrs to matrix
                    }
                    "g" -> if (!selfClosing) stack += attrs to matrix
                    "defs", "clipPath", "mask", "pattern" -> Unit
                    else -> {
                        val d = pathData(name, own) ?: continue
                        val path = runCatching { PathParser().parsePathString(d).toPath() }.getOrNull() ?: continue
                        if (attrs["fill-rule"] == "evenodd") path.fillType = PathFillType.EvenOdd
                        if (!matrix.isIdentity()) path.transform(matrix)
                        val scale = matrix.values[Matrix.ScaleX]
                        shapes += SvgShape(
                            path = path,
                            fill = attrs["fill"] ?: "#000000",
                            stroke = attrs["stroke"],
                            strokeWidth = (attrs["stroke-width"]?.toFloatOrNull() ?: 1f) * scale,
                            cap = when (attrs["stroke-linecap"]) { "round" -> StrokeCap.Round; "square" -> StrokeCap.Square; else -> StrokeCap.Butt },
                            join = when (attrs["stroke-linejoin"]) { "round" -> StrokeJoin.Round; "bevel" -> StrokeJoin.Bevel; else -> StrokeJoin.Miter },
                        )
                    }
                }
            }
            if (width <= 0f) width = viewBox.width
            if (height <= 0f) height = viewBox.height
            return SvgDoc(viewBox, width, height, shapes)
        }

        private val NOT_INHERITED = setOf("transform", "d", "cx", "cy", "r", "rx", "ry", "x", "y", "width", "height", "x1", "y1", "x2", "y2", "points", "viewBox", "id", "class", "style")

        private fun f(a: Map<String, String>, k: String) = a[k]?.toFloatOrNull() ?: 0f

        private fun pathData(name: String, a: Map<String, String>): String? = when (name) {
            "path" -> a["d"]
            "circle" -> {
                val cx = f(a, "cx"); val cy = f(a, "cy"); val r = f(a, "r")
                "M${cx - r},${cy}a$r,$r 0 1,0 ${2 * r},0a$r,$r 0 1,0 ${-2 * r},0z"
            }
            "ellipse" -> {
                val cx = f(a, "cx"); val cy = f(a, "cy"); val rx = f(a, "rx"); val ry = f(a, "ry")
                "M${cx - rx},${cy}a$rx,$ry 0 1,0 ${2 * rx},0a$rx,$ry 0 1,0 ${-2 * rx},0z"
            }
            "rect" -> {
                val x = f(a, "x"); val y = f(a, "y"); val w = f(a, "width"); val h = f(a, "height")
                val r = minOf(a["rx"]?.toFloatOrNull() ?: a["ry"]?.toFloatOrNull() ?: 0f, w / 2, h / 2)
                if (r == 0f) "M$x,${y}h${w}v${h}h${-w}z"
                else "M${x + r},${y}h${w - 2 * r}a$r,$r 0 0 1 $r,$r" + "v${h - 2 * r}a$r,$r 0 0 1 ${-r},$r" +
                    "h${-(w - 2 * r)}a$r,$r 0 0 1 ${-r},${-r}v${-(h - 2 * r)}a$r,$r 0 0 1 $r,${-r}z"
            }
            "line" -> "M${f(a, "x1")},${f(a, "y1")}L${f(a, "x2")},${f(a, "y2")}"
            "polyline", "polygon" -> {
                val pts = a["points"]?.trim()?.split(Regex("[\\s,]+"))?.filter { it.isNotEmpty() } ?: return null
                "M" + pts.chunked(2).filter { it.size == 2 }.joinToString("L") { "${it[0]},${it[1]}" } + if (name == "polygon") "z" else ""
            }
            else -> null
        }

        /** translate(x[,y]) scale(sx[,sy]) matrix(a,b,c,d,e,f) - в порядке записи. */
        internal fun transformOf(value: String): Matrix {
            var result = Matrix()
            Regex("""(translate|scale|matrix)\s*\(([^)]*)\)""").findAll(value).forEach { m ->
                val n = m.groupValues[2].split(Regex("[\\s,]+")).mapNotNull { it.toFloatOrNull() }
                val step = Matrix()
                when (m.groupValues[1]) {
                    "translate" -> step.translate(n.getOrElse(0) { 0f }, n.getOrElse(1) { 0f })
                    "scale" -> step.scale(n.getOrElse(0) { 1f }, n.getOrElse(1) { n.getOrElse(0) { 1f } })
                    "matrix" -> if (n.size == 6) {
                        step.values[Matrix.ScaleX] = n[0]; step.values[Matrix.SkewY] = n[1]
                        step.values[Matrix.SkewX] = n[2]; step.values[Matrix.ScaleY] = n[3]
                        step.values[Matrix.TranslateX] = n[4]; step.values[Matrix.TranslateY] = n[5]
                    }
                }
                // Запись «translate(...) scale(...)» - сначала scale, потом translate: p·S·T.
                step.timesAssign(result)
                result = step
            }
            return result
        }
    }
}

/** Разбор цвета SVG: none, currentColor, var(--имя), #rgb, #rrggbb, white/black. */
private fun svgColor(value: String?, current: Color, vars: Map<String, Color>): Color? {
    val v = value?.trim() ?: return null
    return when {
        v == "none" || v == "transparent" -> null
        v == "currentColor" -> current
        v.startsWith("var(") -> vars[v.removePrefix("var(").removeSuffix(")").trim().removePrefix("--")] ?: current
        v.startsWith("#") -> {
            val hex = v.drop(1).let { if (it.length == 3) it.map { c -> "$c$c" }.joinToString("") else it }
            hex.toLongOrNull(16)?.let { Color(0xFF000000 or (it and 0xFFFFFF)) }
        }
        v == "white" -> Color.White
        v == "black" -> Color.Black
        else -> current
    }
}

/**
 * Рисует [icon] в прямоугольник [rect] (по умолчанию - весь холст) с растяжением, как img
 * в вёрстке сайта. [color] - currentColor и цвет заливки по умолчанию; [fill] - заменить все
 * заливки одним цветом (как CSS path{fill:...}); [vars] - значения var(--имя).
 */
fun DrawScope.drawSvg(
    icon: SvgIcon,
    rect: Rect = Rect(0f, 0f, size.width, size.height),
    color: Color = Color.Black,
    fill: Color? = null,
    vars: Map<String, Color> = emptyMap(),
    colorFilter: ColorFilter? = null,
    fillOverlay: (DrawScope.(Path) -> Unit)? = null,
) {
    val doc = icon.doc
    val sx = rect.width / doc.viewBox.width
    val sy = rect.height / doc.viewBox.height
    withTransform({
        translate(rect.left, rect.top)
        scale(sx, sy, pivot = androidx.compose.ui.geometry.Offset.Zero)
        translate(-doc.viewBox.left, -doc.viewBox.top)
    }) {
        for (shape in doc.shapes) {
            val fillColor = fill ?: svgColor(shape.fill, color, vars)
            if (fillColor != null) drawPath(shape.path, fillColor, style = Fill, colorFilter = colorFilter)
            // Поверх заливки, в координатах viewBox и в границах фигуры (штриховка устаревших машин).
            if (fillColor != null && fillOverlay != null) clipPath(shape.path) { fillOverlay(shape.path) }
            svgColor(shape.stroke, color, vars)?.let { stroke ->
                drawPath(shape.path, stroke, style = Stroke(width = shape.strokeWidth, cap = shape.cap, join = shape.join), colorFilter = colorFilter)
            }
        }
    }
}

/** Значок во весь размер (ширина [width], высота - по пропорциям), цветом [tint] (currentColor и заливка). */
@Composable
fun SvgImage(icon: SvgIcon, width: Dp, contentDescription: String?, modifier: Modifier = Modifier, tint: Color? = null) {
    Canvas(
        modifier
            .size(width, width / icon.aspect)
            .then(if (contentDescription != null) Modifier.semantics { this.contentDescription = contentDescription } else Modifier),
    ) {
        clipRect { drawSvg(icon, color = tint ?: Color.Black, colorFilter = tint?.let { ColorFilter.tint(it) }) }
    }
}

internal fun Size.rect() = Rect(0f, 0f, width, height)
