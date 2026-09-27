package ru.khudob1n.krasnodar.transport.ui.info

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.khudob1n.krasnodar.transport.data.Article
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme

/** Блок статьи после разбора markdown. */
private sealed interface Block {
    data class Heading(val level: Int, val text: String) : Block
    data class Paragraph(val text: String) : Block
    data class Bullets(val items: List<String>) : Block
    data object Legend : Block
}

/**
 * Разбор markdown статей (site/faq_articles): заголовки #..####, абзацы, списки «- »,
 * **жирный** и шорткод [[legend]]. Больше в статьях ничего нет; сайт рисует их markdown-it.
 */
private fun parse(body: String): List<Block> {
    val blocks = mutableListOf<Block>()
    val paragraph = mutableListOf<String>()
    val bullets = mutableListOf<String>()
    fun flush() {
        if (paragraph.isNotEmpty()) { blocks += Block.Paragraph(paragraph.joinToString(" ")); paragraph.clear() }
        if (bullets.isNotEmpty()) { blocks += Block.Bullets(bullets.toList()); bullets.clear() }
    }
    for (raw in body.lines()) {
        val line = raw.trim()
        when {
            line.isEmpty() -> flush()
            line == "[[legend]]" -> { flush(); blocks += Block.Legend }
            line.startsWith("#") -> {
                flush()
                val level = line.takeWhile { it == '#' }.length
                blocks += Block.Heading(level, line.drop(level).trim())
            }
            line.startsWith("- ") || line.startsWith("* ") -> {
                if (paragraph.isNotEmpty()) flush()
                bullets += line.drop(2).trim()
            }
            bullets.isNotEmpty() -> bullets[bullets.lastIndex] = bullets.last() + " " + line
            else -> paragraph += line
        }
    }
    flush()
    return blocks
}

/** **жирный** - полужирным. */
private fun inline(text: String): AnnotatedString = buildAnnotatedString {
    val parts = text.split("**")
    parts.forEachIndexed { i, part -> if (i % 2 == 1) withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append(part) } else append(part) }
}

/** Статья (Article сайта): заголовок и текст; «Как пользоваться картой» - с легендой карты. */
@Composable
fun ArticleCard(article: Article) {
    val colors = AppTheme.colors
    val text = AppTheme.type.body.copy(fontSize = 17.sp, lineHeight = 25.sp)
    Column(Modifier.verticalScroll(rememberScrollState()).padding(start = 24.dp, end = 24.dp, top = 4.dp, bottom = 32.dp)) {
        Text(article.title, Modifier.padding(end = 32.dp, bottom = 20.dp).semantics { heading() }, style = AppTheme.type.h3, color = colors.textPrimary)
        parse(article.body).forEach { block ->
            when (block) {
                is Block.Heading -> Text(
                    block.text,
                    Modifier.padding(top = 28.dp, bottom = 12.dp).semantics { heading() },
                    style = AppTheme.type.h4.copy(fontSize = if (block.level <= 2) 24.sp else 20.sp, lineHeight = 26.sp),
                    color = colors.textPrimary,
                )
                is Block.Paragraph -> Text(inline(block.text), Modifier.padding(bottom = 18.dp), style = text, color = colors.textPrimary)
                is Block.Bullets -> Column(Modifier.padding(bottom = 18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    block.items.forEach { item ->
                        // Маркер - тире, как у сайта (ul > li:before «—»).
                        Row(Modifier.fillMaxWidth()) {
                            Text("—", Modifier.width(24.dp), style = text, color = colors.textPrimary.copy(alpha = 0.45f))
                            Text(inline(item), Modifier.weight(1f), style = text, color = colors.textPrimary)
                        }
                    }
                }
                Block.Legend -> Column(Modifier.padding(bottom = 18.dp)) { MapLegend() }
            }
        }
    }
}
