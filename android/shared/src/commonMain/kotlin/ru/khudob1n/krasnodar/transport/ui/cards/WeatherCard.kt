package ru.khudob1n.krasnodar.transport.ui.cards

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.datetime.LocalDate
import ru.khudob1n.krasnodar.transport.assets.Tabler
import ru.khudob1n.krasnodar.transport.data.Weather
import ru.khudob1n.krasnodar.transport.data.WeatherDetails
import ru.khudob1n.krasnodar.transport.data.WeatherDetailsApi
import ru.khudob1n.krasnodar.transport.data.windName
import ru.khudob1n.krasnodar.transport.map.formatTemperature
import ru.khudob1n.krasnodar.transport.map.weatherIcon
import ru.khudob1n.krasnodar.transport.ui.components.SvgIcon
import ru.khudob1n.krasnodar.transport.ui.components.TablerIcon
import ru.khudob1n.krasnodar.transport.ui.components.WeatherSkeleton
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme

private val RAIN = Color(0xFF3B82F6)
private val WEEKDAYS = listOf("пн", "вт", "ср", "чт", "пт", "сб", "вс")
private val MONTHS = listOf("янв", "февр", "мар", "апр", "мая", "июн", "июл", "авг", "сент", "окт", "нояб", "дек")

private fun dayLabel(date: String, index: Int): String = when (index) {
    0 -> "Сегодня"
    1 -> "Завтра"
    else -> runCatching { LocalDate.parse(date) }.getOrNull()?.let { "${WEEKDAYS[it.dayOfWeek.ordinal]}, ${it.day} ${MONTHS[it.month.ordinal]}" } ?: date
}

/**
 * Подробная погода по нажатию на плашку (MapWeatherSidebar сайта): сейчас, подсказка для поездки,
 * ветер, влажность, давление, восход и закат, по часам на сутки и на неделю. Open-Meteo.
 */
@Composable
fun WeatherCard() {
    val colors = AppTheme.colors
    var weather by remember { mutableStateOf<WeatherDetails?>(null) }
    var failed by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { runCatching { WeatherDetailsApi.fetch() }.onSuccess { weather = it }.onFailure { failed = true } }

    Column(Modifier.verticalScroll(rememberScrollState()).padding(bottom = 16.dp)) {
        Column(Modifier.padding(start = 16.dp, end = 64.dp, top = 4.dp, bottom = 12.dp)) {
            Text("Погода", style = AppTheme.type.h4.copy(fontWeight = FontWeight.Bold), color = colors.textPrimary)
            Text("Краснодар", style = AppTheme.type.small, color = colors.functional)
        }
        val w = weather
        when {
            failed -> Text("Не удалось загрузить погоду. Попробуйте позже.", Modifier.padding(16.dp), style = AppTheme.type.body, color = colors.functional)
            w == null -> WeatherSkeleton()
            else -> Details(w)
        }
    }
}

@Composable
private fun Details(w: WeatherDetails) {
    val colors = AppTheme.colors
    // Сейчас: крупная иконка и температура, состояние и «ощущается как».
    Row(Modifier.padding(horizontal = 16.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        val (icon, tint) = weatherIcon(w.now)
        TablerIcon(icon, null, Modifier.size(52.dp), tint = tint)
        Text(formatTemperature(w.now.temperature), style = AppTheme.type.body.copy(fontSize = 46.sp, lineHeight = 50.sp, fontWeight = FontWeight.SemiBold), color = colors.textPrimary)
        Column {
            Text(w.now.kind.title, style = AppTheme.type.body, color = colors.textPrimary)
            Text("Ощущается как ${formatTemperature(w.feelsLike)}", style = AppTheme.type.small.copy(fontSize = 14.sp), color = colors.textSecondary)
        }
    }

    w.hint?.let { hint ->
        Row(
            Modifier.padding(horizontal = 16.dp, vertical = 12.dp).fillMaxWidth()
                .background(colors.backgroundSecondary, RoundedCornerShape(14.dp)).padding(horizontal = 14.dp, vertical = 12.dp)
                .semantics { liveRegion = LiveRegionMode.Polite },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            TablerIcon(Tabler.umbrella, null, Modifier.size(22.dp), tint = RAIN)
            Text(hint, style = AppTheme.type.body.copy(fontSize = 15.sp, lineHeight = 20.sp), color = colors.textPrimary)
        }
    }

    Column(Modifier.padding(horizontal = 16.dp).padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Fact(Tabler.wind, "${w.wind} м/с", "${windName(w.windFrom)}, порывы ${w.gusts}", Modifier.weight(1f))
            Fact(Tabler.droplet, "${w.humidity}%", "влажность", Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Fact(Tabler.gauge, "${w.pressure} мм", "давление", Modifier.weight(1f))
            Fact(Tabler.sunrise, "${w.sunrise} – ${w.sunset}", "восход и закат", Modifier.weight(1f))
        }
    }

    SectionTitle("По часам")
    Row(Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 12.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        w.hours.forEachIndexed { index, hour ->
            Column(
                Modifier.width(56.dp).background(if (index == 0) colors.backgroundSecondary else Color.Transparent, RoundedCornerShape(14.dp)).padding(vertical = 10.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(if (index == 0) "Сейчас" else hour.time, style = AppTheme.type.small.copy(fontSize = 12.sp), color = colors.textSecondary)
                val (icon, tint) = weatherIcon(Weather(hour.temperature, hour.kind, hour.isDay))
                TablerIcon(icon, null, Modifier.size(22.dp), tint = tint)
                Text(formatTemperature(hour.temperature), style = AppTheme.type.body.copy(fontSize = 15.sp, fontWeight = FontWeight.SemiBold), color = colors.textPrimary)
                Text(if (hour.precipitation >= 20) "${hour.precipitation}%" else "", style = AppTheme.type.small.copy(fontSize = 12.sp, fontWeight = FontWeight.Medium), color = RAIN)
            }
        }
    }

    CardDivider()
    SectionTitle("На неделю")
    Column(Modifier.padding(horizontal = 16.dp)) {
        w.days.forEachIndexed { index, day ->
            if (index > 0) Box(Modifier.fillMaxWidth().height(1.dp).background(colors.backgroundSecondary))
            Row(Modifier.fillMaxWidth().padding(vertical = 10.dp, horizontal = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(dayLabel(day.date, index), Modifier.weight(1f), style = AppTheme.type.body.copy(fontSize = 15.sp), color = colors.textPrimary)
                val (icon, tint) = weatherIcon(Weather(day.max, day.kind, true))
                TablerIcon(icon, null, Modifier.size(22.dp), tint = tint)
                Text(if (day.precipitation >= 20) "${day.precipitation}%" else "", Modifier.width(48.dp), style = AppTheme.type.small.copy(fontSize = 12.sp, fontWeight = FontWeight.Medium), color = RAIN, textAlign = TextAlign.Center)
                Row(Modifier.width(96.dp), horizontalArrangement = Arrangement.End) {
                    Text(formatTemperature(day.min), style = AppTheme.type.body.copy(fontSize = 15.sp), color = colors.textSecondary)
                    Text(" … ${formatTemperature(day.max)}", style = AppTheme.type.body.copy(fontSize = 15.sp, fontWeight = FontWeight.SemiBold), color = colors.textPrimary)
                }
            }
        }
    }
    Text("Данные: Open-Meteo", Modifier.padding(start = 16.dp, top = 12.dp), style = AppTheme.type.small.copy(fontSize = 12.sp), color = colors.functional)
}

@Composable
private fun SectionTitle(text: String) =
    Text(text, Modifier.padding(start = 16.dp, top = 16.dp, bottom = 8.dp), style = AppTheme.type.small.copy(fontWeight = FontWeight.SemiBold), color = AppTheme.colors.textSecondary)

@Composable
private fun Fact(icon: SvgIcon, value: String, label: String, modifier: Modifier) {
    val colors = AppTheme.colors
    Row(
        modifier.background(colors.backgroundSecondary, RoundedCornerShape(14.dp)).padding(horizontal = 12.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        TablerIcon(icon, null, Modifier.size(20.dp), tint = colors.functional)
        Column {
            Text(value, style = AppTheme.type.body.copy(fontSize = 15.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold), color = colors.textPrimary)
            Text(label, style = AppTheme.type.small.copy(fontSize = 12.sp, lineHeight = 16.sp), color = colors.textSecondary)
        }
    }
}
