package ru.khudob1n.krasnodar.transport.ui.cards

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.ui.semantics.Role
import ru.khudob1n.krasnodar.transport.ui.journey.JourneyMarker
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import ru.khudob1n.krasnodar.transport.R
import ru.khudob1n.krasnodar.transport.data.ScheduleTrip
import ru.khudob1n.krasnodar.transport.data.Stop
import ru.khudob1n.krasnodar.transport.data.transportOfRu
import ru.khudob1n.krasnodar.transport.domain.StopBoard
import ru.khudob1n.krasnodar.transport.domain.cityNow
import ru.khudob1n.krasnodar.transport.domain.dayTypeOf
import ru.khudob1n.krasnodar.transport.domain.formatArrival
import ru.khudob1n.krasnodar.transport.settings.LocalFavorites
import ru.khudob1n.krasnodar.transport.settings.LocalMapPreferences
import ru.khudob1n.krasnodar.transport.ui.components.FavoriteButton
import ru.khudob1n.krasnodar.transport.ui.components.StopBoardSkeleton
import ru.khudob1n.krasnodar.transport.settings.StopDefaultView
import ru.khudob1n.krasnodar.transport.domain.stopBoard
import ru.khudob1n.krasnodar.transport.map.StopKind
import ru.khudob1n.krasnodar.transport.ui.components.PillButton
import ru.khudob1n.krasnodar.transport.ui.components.RouteBadge
import ru.khudob1n.krasnodar.transport.ui.components.TablerIcon
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme

private val KIND_LABELS = mapOf(
    StopKind.Bus to "Остановка автобуса",
    StopKind.Tram to "Остановка трамвая",
    StopKind.Troll to "Остановка троллейбуса",
    StopKind.TrollBus to "Остановка троллейбуса и автобуса",
)

/**
 * Карточка остановки (components/Map/Stops/Sidebar сайта): шапка, ближайшие отправления,
 * пересчёт раз в минуту, полное расписание по кнопке.
 */
@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
fun StopCard(
    stop: Stop,
    kind: StopKind,
    loadSchedule: suspend (Long) -> List<ScheduleTrip>,
    onJourney: (fromHere: Boolean) -> Unit = {},
) {
    var trips by remember(stop.id) { mutableStateOf<List<ScheduleTrip>?>(null) }
    var failed by remember(stop.id) { mutableStateOf(false) }
    var tick by remember { mutableStateOf(0) }
    // «Карточка остановки открывается»: с ближайшими рейсами или сразу с расписанием.
    val openSchedule = LocalMapPreferences.current.stopDefaultView == StopDefaultView.Schedule
    var scheduleOpened by remember(stop.id) { mutableStateOf(openSchedule) }

    LaunchedEffect(stop.id) {
        runCatching { loadSchedule(stop.id) }.onSuccess { trips = it }.onFailure { failed = true }
    }
    // Ближайшие рейсы пересчитываются раз в минуту, пока карточка открыта (как на сайте).
    LaunchedEffect(Unit) { while (true) { delay(60_000); tick++ } }

    Column(Modifier.verticalScroll(rememberScrollState())) {
        Row(
            Modifier.fillMaxWidth().padding(start = 16.dp, end = 64.dp, top = 4.dp, bottom = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            StopKindIcon(kind, 37.dp)
            Column {
                Text(KIND_LABELS.getValue(kind), style = AppTheme.type.small, color = AppTheme.colors.textSecondary)
                Text(stop.name, style = AppTheme.type.h4, color = AppTheme.colors.textPrimary)
            }
        }
        CardDivider()

        val board = trips?.let { tick.let { _ -> stopBoard(it) } }
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            when {
                failed -> Notice("Не удалось загрузить расписание", "Проверьте интернет и откройте остановку ещё раз")
                board == null -> StopBoardSkeleton()
                board is StopBoard.Departures -> board.items.forEach { d ->
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        RouteBadge(d.route, d.type)
                        Text(d.to, Modifier.weight(1f), style = AppTheme.type.caption, color = AppTheme.colors.textPrimary)
                        Text(formatArrival(d.time, LocalMapPreferences.current.arrivalFormat), style = AppTheme.type.caption, color = AppTheme.colors.textPrimary)
                    }
                }
                board is StopBoard.NoSchedule -> Notice("Расписание не опубликовано", "Для этой остановки нет расписания.")
                board is StopBoard.NoServiceToday -> Notice("Сегодня транспорт не ходит", "По этой остановке сегодня нет рейсов")
                board is StopBoard.NoMoreToday -> Notice("Сегодня рейсов больше нет", "Следующие отправления — завтра, их видно в расписании")
            }
            val favorites = LocalFavorites.current
            // С крупным шрифтом кнопки в строку не помещаются - переносятся.
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (!trips.isNullOrEmpty()) {
                    PillButton(
                        "Расписание",
                        onClick = { scheduleOpened = !scheduleOpened },
                        icon = R.drawable.tabler_calendar_time,
                    )
                }
                FavoriteButton(favorites.value.hasStop(stop.id), "остановку", { favorites.update { it.toggleStop(stop.id) } })
            }
            // «Отсюда» и «Сюда» (JourneyStopButtons сайта): подпись объясняет, что делают кнопки.
            Text("Построить маршрут", style = AppTheme.type.small, color = AppTheme.colors.textSecondary)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                JourneyPill("A", "Отсюда") { onJourney(true) }
                JourneyPill("B", "Сюда") { onJourney(false) }
            }
            AnimatedVisibility(scheduleOpened && trips != null) {
                FullSchedule(trips.orEmpty())
            }
        }
    }
}

@Composable
private fun Notice(title: String, text: String) {
    Row(
        Modifier.fillMaxWidth().background(AppTheme.colors.backgroundSecondary, RoundedCornerShape(16.dp)).padding(14.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        TablerIcon(R.drawable.tabler_alert_triangle, null, tint = AppTheme.colors.warning)
        Column {
            Text(title, style = AppTheme.type.body.copy(fontWeight = FontWeight.SemiBold), color = AppTheme.colors.textPrimary)
            Text(text, style = AppTheme.type.small, color = AppTheme.colors.textSecondary)
        }
    }
}

/**
 * Полное расписание остановки (MapStopSchedule сайта): переключатель будни / выходные, по
 * каждому маршруту и направлению - часы и минуты отправлений.
 */
@Composable
private fun FullSchedule(trips: List<ScheduleTrip>) {
    var dayType by remember { mutableStateOf(dayTypeOf(cityNow())) }
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for (type in listOf("будни", "выходные")) {
                val selected = type == dayType
                Text(
                    type.replaceFirstChar { it.uppercase() },
                    Modifier
                        .background(
                            if (selected) AppTheme.colors.textPrimary else AppTheme.colors.backgroundSecondary,
                            RoundedCornerShape(11.dp),
                        )
                        .selectableNoIndication(selected) { dayType = type }
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                    style = AppTheme.type.button,
                    color = if (selected) AppTheme.colors.backgroundPrimary else AppTheme.colors.textPrimary,
                )
            }
        }
        val groups = trips.filter { it.dayType == dayType }.groupBy { Triple(it.routeNumber, it.routeType, it.toStation) }
            .toSortedMap(compareBy({ transportOfRu(it.second)?.ordinal ?: 9 }, { it.first.filter(Char::isDigit).toIntOrNull() ?: 0 }, { it.first }, { it.third }))
        if (groups.isEmpty()) Text("В этот день рейсов нет", style = AppTheme.type.body, color = AppTheme.colors.functional)
        groups.forEach { (key, list) ->
            val type = transportOfRu(key.second) ?: return@forEach
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    RouteBadge(key.first, type)
                    Text("в сторону «${key.third}»", style = AppTheme.type.body, color = AppTheme.colors.textSecondary)
                }
                list.map { it.time }.distinct().sorted().groupBy { it.substringBefore(':') }.forEach { (hour, times) ->
                    Row {
                        Text(hour, Modifier.width(32.dp), style = AppTheme.type.mono.copy(fontWeight = FontWeight.Bold, fontSize = 15.sp), color = AppTheme.colors.textPrimary)
                        Text(times.joinToString("  ") { it.substringAfter(':') }, style = AppTheme.type.mono.copy(fontSize = 15.sp), color = AppTheme.colors.textSecondary)
                    }
                }
            }
        }
        Spacer(Modifier.size(8.dp))
    }
}

@Composable
private fun JourneyPill(letter: String, label: String, onClick: () -> Unit) {
    Row(
        Modifier.heightIn(min = 38.dp).background(AppTheme.colors.backgroundSecondary, AppTheme.shapes.pill)
            .border(1.dp, AppTheme.colors.functionalTram.copy(alpha = 0.4f), AppTheme.shapes.pill)
            .clickable(role = Role.Button, onClickLabel = if (letter == "A") "Маршрут отсюда" else "Маршрут сюда", onClick = onClick)
            .padding(start = 10.dp, end = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        JourneyMarker(letter, size = 20)
        Text(label, style = AppTheme.type.button, color = AppTheme.colors.textPrimary)
    }
}
