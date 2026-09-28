package ru.khudob1n.krasnodar.transport.map

import ru.khudob1n.krasnodar.transport.assets.Tabler

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import ru.khudob1n.krasnodar.transport.data.Traffic
import ru.khudob1n.krasnodar.transport.data.Weather
import ru.khudob1n.krasnodar.transport.data.WeatherApi
import ru.khudob1n.krasnodar.transport.data.WeatherKind
import ru.khudob1n.krasnodar.transport.domain.plural
import ru.khudob1n.krasnodar.transport.ui.components.SvgIcon
import ru.khudob1n.krasnodar.transport.ui.components.TablerIcon
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme
import ru.khudob1n.krasnodar.transport.ui.theme.fixedSp

private const val TRAFFIC_REFRESH_MS = 2 * 60 * 1000L

/**
 * Плашки пробок и погоды в ряду кнопок карты (MapTraffic, MapWeather сайта). На телефоне - вторым
 * одной плашкой рядом с поиском (MapControls). Пока данных нет - плашки нет.
 */
@Composable
fun MapBadges(loadTraffic: suspend () -> Traffic, compact: Boolean = false) {
    var traffic by remember { mutableStateOf<Traffic?>(null) }
    var weather by remember { mutableStateOf<Weather?>(null) }
    LaunchedEffect(Unit) { while (true) { runCatching { loadTraffic() }.onSuccess { traffic = it }; delay(TRAFFIC_REFRESH_MS) } }
    LaunchedEffect(Unit) { while (true) { runCatching { WeatherApi.fetch() }.onSuccess { weather = it }; delay(WeatherApi.REFRESH_MS) } }
    if (compact) {
        if (traffic != null || weather != null) CompactBadge(traffic, weather)
        return
    }
    traffic?.let { TrafficBadge(it) }
    weather?.let { WeatherBadge(it) }
}

/**
 * Телефон: пробки и погода одной плашкой рядом с поиском - «(2) | ☾ +19°». Слово «балл» -
 * только в описании для TalkBack.
 */
@Composable
private fun CompactBadge(t: Traffic?, w: Weather?) {
    val description = listOfNotNull(t?.let(::trafficDescription), w?.let { "${it.kind.title}, ${temperatureOf(it)}" }).joinToString(". ")
    Row(
        Modifier.height(48.dp).shadow(6.dp, AppTheme.shapes.mapButton).background(AppTheme.colors.backgroundPrimary, AppTheme.shapes.mapButton)
            .padding(start = if (t != null) 12.dp else 14.dp, end = 14.dp).semantics(mergeDescendants = true) { contentDescription = description },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (t != null) {
            Box(Modifier.size(24.dp).background(colorOf(t), CircleShape), contentAlignment = Alignment.Center) {
                Text(t.level.toString(), style = AppTheme.type.body.copy(fontSize = fixedSp(14f), lineHeight = fixedSp(16f), fontWeight = FontWeight.Bold), color = Color.White)
            }
        }
        if (t != null && w != null) Box(Modifier.padding(horizontal = 9.dp).size(1.dp, 20.dp).background(AppTheme.colors.backgroundSecondary))
        if (w != null) {
            val (icon, color) = weatherIcon(w)
            TablerIcon(icon, null, Modifier.size(20.dp), tint = color)
            Text(
                temperatureOf(w),
                Modifier.padding(start = 4.dp),
                style = AppTheme.type.body.copy(fontSize = 16.sp, fontWeight = FontWeight.SemiBold),
                color = AppTheme.colors.textPrimary,
            )
        }
    }
}

private fun trafficDescription(t: Traffic) =
    "Пробки: ${t.level} ${plural(t.level, "балл", "балла", "баллов")}${t.hint?.let { " — ${it.lowercase()}" } ?: ""}. По данным Яндекса"

// Настоящий минус (U+2212), а не дефис: «−7°».
private fun temperatureOf(w: Weather) = "${if (w.temperature > 0) "+" else if (w.temperature < 0) "−" else ""}${kotlin.math.abs(w.temperature)}°"

@Composable
private fun Badge(description: String, content: @Composable () -> Unit) {
    Row(
        Modifier.height(48.dp).shadow(6.dp, AppTheme.shapes.mapButton).background(AppTheme.colors.backgroundPrimary, AppTheme.shapes.mapButton)
            .padding(start = 12.dp, end = 14.dp).semantics { contentDescription = description },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) { content() }
}

/** Цвета балла - как у Яндекса: зелёный до 3, жёлтый до 6, красный дальше. */
private fun colorOf(t: Traffic) = when (t.color ?: if (t.level <= 3) "green" else if (t.level <= 6) "yellow" else "red") {
    "green" -> Color(0xFF3DB33D)
    "yellow" -> Color(0xFFF2B200)
    else -> Color(0xFFE5352B)
}

@Composable
private fun TrafficBadge(t: Traffic) {
    val word = plural(t.level, "балл", "балла", "баллов")
    Badge(trafficDescription(t)) {
        Box(Modifier.size(26.dp).background(colorOf(t), CircleShape), contentAlignment = Alignment.Center) {
            Text(t.level.toString(), style = AppTheme.type.body.copy(fontSize = fixedSp(15f), lineHeight = fixedSp(17f), fontWeight = FontWeight.Bold), color = Color.White)
        }
        when {
            t.trend > 0 -> TablerIcon(Tabler.trending_up, "растут", Modifier.size(18.dp), tint = AppTheme.colors.functional)
            t.trend < 0 -> TablerIcon(Tabler.trending_down, "спадают", Modifier.size(18.dp), tint = AppTheme.colors.functional)
            else -> Text(word, style = AppTheme.type.body.copy(fontSize = 14.sp, fontWeight = FontWeight.Medium), color = AppTheme.colors.textSecondary)
        }
    }
}

@Composable
private fun weatherIcon(w: Weather): Pair<SvgIcon, Color> {
    val night = !w.isDay && (w.kind == WeatherKind.Clear || w.kind == WeatherKind.Partly)
    val icon = when (w.kind) {
        WeatherKind.Clear -> if (w.isDay) Tabler.sun_high else Tabler.moon_stars
        WeatherKind.Partly -> if (w.isDay) Tabler.sun_low else Tabler.moon
        WeatherKind.Cloudy -> Tabler.cloud
        WeatherKind.Fog -> Tabler.cloud_fog
        WeatherKind.Snow -> Tabler.cloud_snow
        WeatherKind.Storm -> Tabler.cloud_storm
        WeatherKind.Rain -> Tabler.cloud_rain
    }
    val color = when {
        night -> Color(0xFF8A9BD6)
        w.kind == WeatherKind.Clear || w.kind == WeatherKind.Partly -> Color(0xFFF2B200)
        w.kind == WeatherKind.Rain -> Color(0xFF3B82F6)
        w.kind == WeatherKind.Snow -> Color(0xFF38BDF8)
        w.kind == WeatherKind.Storm -> Color(0xFF8B5CF6)
        else -> AppTheme.colors.functional
    }
    return icon to color
}

@Composable
private fun WeatherBadge(w: Weather) {
    val temperature = temperatureOf(w)
    val (icon, color) = weatherIcon(w)
    Badge("${w.kind.title}, $temperature") {
        TablerIcon(icon, null, Modifier.size(22.dp), tint = color)
        Text(temperature, style = AppTheme.type.body.copy(fontSize = 17.sp, fontWeight = FontWeight.SemiBold), color = AppTheme.colors.textPrimary)
    }
}
