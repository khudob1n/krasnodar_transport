package ru.khudob1n.krasnodar.transport.ui.info

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.InlineTextContent
import androidx.compose.foundation.text.appendInlineContent
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.Placeholder
import androidx.compose.ui.text.PlaceholderVerticalAlign
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import ru.khudob1n.krasnodar.transport.R
import ru.khudob1n.krasnodar.transport.ui.cards.CardDivider
import ru.khudob1n.krasnodar.transport.ui.components.TablerIcon
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme

/**
 * Приветствие (MapWelcomeMessage сайта): открывается само при первом запуске и по кнопке «i».
 * Про горячие клавиши, как и сайт на телефоне, не пишем - их нет.
 */
@Composable
fun WelcomeCard() {
    val colors = AppTheme.colors
    Column(Modifier.verticalScroll(rememberScrollState()).padding(top = 4.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Column(Modifier.padding(horizontal = 24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(
                buildAnnotatedString {
                    append("Привет!\nЭто карта транспорта Краснодара ")
                    // Пустой альтернативный текст Compose не принимает; TalkBack значок не читает.
                    appendInlineContent("walk", " ")
                },
                // Справа сверху - крестик закрытия.
                Modifier.padding(end = 32.dp),
                style = AppTheme.type.h3,
                color = colors.textPrimary,
                inlineContent = mapOf(
                    "walk" to InlineTextContent(Placeholder(1.em, 1.em, PlaceholderVerticalAlign.TextCenter)) {
                        TablerIcon(R.drawable.tabler_walk, null, Modifier.size(32.dp), tint = colors.textPrimary)
                    },
                ),
            )
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Paragraph("В карточках транспорта можно посмотреть что за автобус, троллейбус или трамвай едет к вам.")
                Paragraph("А на остановках — сколько ждать нужный вам маршрут.")
                Paragraph("Чтобы открыть карточку — нажмите на любой транспорт или остановку на карте.")
            }
        }
        CardDivider()
        Column(Modifier.padding(horizontal = 24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("Условные обозначения", style = AppTheme.type.h3, color = colors.textPrimary)
            WelcomeNotations()
        }
    }
}

@Composable
private fun Paragraph(text: String) = Text(text, style = AppTheme.type.caption, color = AppTheme.colors.textSecondary)
