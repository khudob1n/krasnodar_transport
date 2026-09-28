package ru.khudob1n.krasnodar.transport.ui.cards

import ru.khudob1n.krasnodar.transport.map.rememberMarkerRenderer

import ru.khudob1n.krasnodar.transport.assets.Tabler

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import ru.khudob1n.krasnodar.transport.data.NotFoundException
import ru.khudob1n.krasnodar.transport.data.RailDeparture
import ru.khudob1n.krasnodar.transport.data.RailSchedule
import ru.khudob1n.krasnodar.transport.data.RailStation
import ru.khudob1n.krasnodar.transport.domain.CITY_ZONE
import ru.khudob1n.krasnodar.transport.domain.cityNow
import ru.khudob1n.krasnodar.transport.map.MarkerRenderer
import ru.khudob1n.krasnodar.transport.ui.components.PillButton
import ru.khudob1n.krasnodar.transport.ui.components.RailBoardSkeleton
import ru.khudob1n.krasnodar.transport.ui.components.TablerIcon
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.LocalDate
import kotlinx.datetime.plus
import kotlinx.datetime.toLocalDateTime
import ru.khudob1n.krasnodar.transport.platform.pad2
import kotlin.time.Clock
import kotlin.time.Instant

private val KIND_LABELS = mapOf(
    "railway_station" to "Железнодорожная станция",
    "rail_stop" to "Пассажирская платформа",
    "bus_terminal" to "Автовокзал",
    "airport" to "Аэропорт",
)

private sealed interface Board {
    data object Loading : Board
    data object Failed : Board
    data object NotFound : Board
    data class Loaded(val items: List<RailDeparture>) : Board
}

/** Карточка вокзала, автовокзала или аэропорта (RailSidebar + RailSchedule сайта). */
@Composable
fun StationCard(station: RailStation, load: suspend (String, String) -> RailSchedule) {
    val colors = AppTheme.colors
    val renderer = rememberMarkerRenderer()
    val accent = renderer.stationColor(station.kind)
    val days = remember {
        val now = cityNow()
        (0..2).map { i ->
            val d = now.date.plus(i, DateTimeUnit.DAY)
            d.toString() to if (i == 0) "Сегодня" else dayLabel(d)
        }
    }
    var date by remember { mutableStateOf(days.first().first) }
    var event by remember { mutableStateOf("departure") }
    var hidePast by remember { mutableStateOf(true) }
    var visible by remember { mutableIntStateOf(20) }
    var board by remember { mutableStateOf<Board>(Board.Loading) }

    LaunchedEffect(station.id, date, event) {
        board = Board.Loading
        visible = 20
        board = runCatching { load(date, event) }.fold(
            onSuccess = { Board.Loaded(it.departures) },
            onFailure = { if (it is NotFoundException) Board.NotFound else Board.Failed },
        )
    }

    Column(Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 16.dp)) {
        Row(Modifier.padding(top = 4.dp, end = 48.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            val px = with(LocalDensity.current) { 32.dp.roundToPx() }
            val dark = colors.isDark
            val icon = remember(station.kind, dark, renderer) { renderer.stationIcon(station.kind, px, dark) }
            Image(icon, null, Modifier.size(32.dp))
            Column {
                Text(KIND_LABELS[station.kind] ?: "", style = AppTheme.type.small, color = colors.textSecondary)
                Text(station.name, style = AppTheme.type.h4, color = colors.textPrimary)
            }
        }
        if (station.description.isNotBlank()) {
            Text(station.description, Modifier.padding(top = 12.dp), style = AppTheme.type.body, color = colors.textSecondary)
        }

        Column(Modifier.padding(vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (station.kind == "airport") {
                Segmented(
                    listOf("departure" to "Вылеты", "arrival" to "Прилёты"),
                    event,
                    icons = mapOf("departure" to Tabler.plane_departure, "arrival" to Tabler.plane_arrival),
                ) { event = it }
            }
            Segmented(days, date) { date = it }

            val isToday = date == days.first().first
            when (val b = board) {
                Board.Loading -> RailBoardSkeleton()
                Board.Failed -> NoticeBox("Нет данных о расписании", "Не удалось загрузить расписание. Попробуйте позже")
                Board.NotFound -> NoticeBox("Нет расписания", "Для этой станции расписание не публикуется")
                is Board.Loaded -> {
                    val now = Clock.System.now()
                    fun timeOf(d: RailDeparture) = (if (event == "arrival") d.arrival else d.departure)?.let { runCatching { Instant.parse(it) }.getOrNull() }
                    val shown = b.items.filter { !hidePast || !isToday || (timeOf(it)?.let { t -> t < now } != true) }
                    if (isToday && b.items.isNotEmpty()) {
                        PillButton(if (hidePast) "Показать прошедшие" else "Скрыть прошедшие", { hidePast = !hidePast }, icon = Tabler.chevron_down)
                    }
                    when {
                        b.items.isEmpty() -> Text("${if (isToday) "Сегодня" else "В этот день"} ${if (event == "arrival") "прибытий" else "отправлений"} нет", style = AppTheme.type.body, color = colors.functional)
                        shown.isEmpty() -> Text("Все ${if (event == "arrival") "прибытия" else "отправления"} на сегодня уже прошли", style = AppTheme.type.body, color = colors.functional)
                        else -> {
                            val next = if (isToday) shown.indexOfFirst { timeOf(it)?.let { t -> t < now } == false } else -1
                            shown.take(visible).forEachIndexed { index, d ->
                                val t = timeOf(d)
                                val until = if (index == next && t != null) (t - now).inWholeMinutes.takeIf { it in 0..59 } else null
                                DepartureRow(d, t, until, event, station.kind == "airport", accent)
                            }
                            if (shown.size > visible) PillButton("Показать ещё", { visible += 20 })
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DepartureRow(d: RailDeparture, time: Instant?, until: Long?, event: String, airport: Boolean, accent: Color) {
    val colors = AppTheme.colors
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(Modifier.width(64.dp)) {
            Text(time?.toLocalDateTime(CITY_ZONE)?.let { "${it.hour.pad2()}:${it.minute.pad2()}" } ?: "—", style = AppTheme.type.caption.copy(fontWeight = FontWeight.SemiBold), color = colors.textPrimary)
            if (until != null) Text(if (until == 0L) "сейчас" else "через $until мин", style = AppTheme.type.small, color = accent)
        }
        if (airport) {
            // Логотипы авиакомпаний сайт берёт с pics.avs.io; здесь - код авиакомпании, как сайт при ошибке загрузки.
            Box(Modifier.size(28.dp).background(colors.backgroundSecondary, RoundedCornerShape(8.dp)), contentAlignment = Alignment.Center) {
                Text(d.carrierCode.ifBlank { "✈" }, style = AppTheme.type.small.copy(fontWeight = FontWeight.SemiBold), color = colors.textSecondary)
            }
        }
        Column(Modifier.weight(1f)) {
            Text(tripTitle(d.title, event), style = AppTheme.type.body.copy(fontWeight = FontWeight.SemiBold), color = colors.textPrimary)
            Text(departureLabel(d) + if (d.carrier.isNotBlank()) " · ${d.carrier}" else "", style = AppTheme.type.small, color = colors.textSecondary)
        }
        val place = if (d.platform.isNotBlank()) "Путь ${d.platform}" else if (d.terminal.isNotBlank()) "Терминал ${d.terminal}" else null
        if (place != null) Text(place, style = AppTheme.type.small, color = colors.functional)
    }
}

private fun departureLabel(d: RailDeparture): String {
    val type = when (d.transportType) { "bus" -> "Автобус"; "plane" -> "Рейс"; "suburban" -> "Электричка"; else -> "Поезд" }
    return if (d.number.isNotBlank()) "$type ${d.number}" else type
}

/** Если один конец рейса - Краснодар, на табло он лишний (tripTitle сайта). */
private fun tripTitle(title: String, event: String): String {
    val parts = title.split(" — ")
    if (parts.size != 2) return title
    val (from, to) = parts
    if (event == "departure" && from.startsWith("Краснодар")) return to
    if (event == "arrival" && to.startsWith("Краснодар")) return from
    return title
}

/** Сегменты (controls.Segmented / Tabs сайта). */
@Composable
fun Segmented(options: List<Pair<String, String>>, selected: String, icons: Map<String, ru.khudob1n.krasnodar.transport.ui.components.SvgIcon> = emptyMap(), onSelect: (String) -> Unit) {
    val colors = AppTheme.colors
    Row(
        Modifier.background(colors.backgroundSecondary, RoundedCornerShape(12.dp)).padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        options.forEach { (key, label) ->
            val active = key == selected
            Row(
                Modifier
                    .background(if (active) colors.backgroundPrimary else Color.Transparent, RoundedCornerShape(10.dp))
                    .selectableNoIndication(active) { onSelect(key) }
                    .padding(horizontal = 12.dp, vertical = 7.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                icons[key]?.let { TablerIcon(it, null, Modifier.size(18.dp), tint = colors.textPrimary) }
                Text(label, style = AppTheme.type.button, color = if (active) colors.textPrimary else colors.textSecondary)
            }
        }
    }
}

@Composable
fun NoticeBox(title: String, text: String) {
    Row(
        Modifier.fillMaxWidth().border(1.dp, AppTheme.colors.backgroundSecondary, RoundedCornerShape(16.dp)).background(AppTheme.colors.backgroundSecondary, RoundedCornerShape(16.dp)).padding(14.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        TablerIcon(Tabler.alert_triangle, null, tint = AppTheme.colors.warning)
        Column {
            Text(title, style = AppTheme.type.body.copy(fontWeight = FontWeight.SemiBold), color = AppTheme.colors.textPrimary)
            Text(text, style = AppTheme.type.small, color = AppTheme.colors.textSecondary)
        }
    }
}

private val WEEKDAYS = listOf("пн", "вт", "ср", "чт", "пт", "сб", "вс")
private val MONTHS = listOf("янв", "февр", "мар", "апр", "мая", "июн", "июл", "авг", "сент", "окт", "нояб", "дек")

/** «вт, 29 сент» - как DateTimeFormatter «EE, d MMM» по-русски без точек. */
private fun dayLabel(d: LocalDate) = "${WEEKDAYS[d.dayOfWeek.ordinal]}, ${d.day} ${MONTHS[d.month.ordinal]}"
