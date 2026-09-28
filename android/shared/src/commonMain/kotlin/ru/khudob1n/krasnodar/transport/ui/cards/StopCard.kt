package ru.khudob1n.krasnodar.transport.ui.cards

import ru.khudob1n.krasnodar.transport.assets.Tabler

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
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
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
import ru.khudob1n.krasnodar.transport.ui.components.PillGrid
import ru.khudob1n.krasnodar.transport.ui.components.PillLabel
import ru.khudob1n.krasnodar.transport.ui.components.ShareButton
import ru.khudob1n.krasnodar.transport.ui.components.ShareLinks
import ru.khudob1n.krasnodar.transport.ui.components.pillArrangement
import ru.khudob1n.krasnodar.transport.ui.components.pillPadding
import ru.khudob1n.krasnodar.transport.ui.components.pillWidth
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
            // Действия - под ближайшими рейсами, сеткой в две колонки, как на сайте: маршрут
            // первой парой («Отсюда» и «Сюда» всегда рядом), дальше расписание, избранное, поделиться.
            PillGrid {
                caption("Построить маршрут")
                button { JourneyPill("A", "Отсюда") { onJourney(true) } }
                button { JourneyPill("B", "Сюда") { onJourney(false) } }
                if (!trips.isNullOrEmpty()) button {
                    val turn by androidx.compose.animation.core.animateFloatAsState(if (scheduleOpened) 180f else 0f, label = "arrow")
                    PillButton("Расписание", onClick = { scheduleOpened = !scheduleOpened }, icon = Tabler.calendar_time, active = scheduleOpened) {
                        TablerIcon(Tabler.chevron_down, null, Modifier.size(16.dp).rotate(turn), tint = AppTheme.colors.functional)
                    }
                }
                button { FavoriteButton(favorites.value.hasStop(stop.id), "остановку", { favorites.update { it.toggleStop(stop.id) } }) }
                button { ShareButton(ShareLinks.stop(stop.id), "Остановка «${stop.name}» на карте транспорта") }
            }
            AnimatedVisibility(scheduleOpened && trips != null) {
                StopSchedule(trips.orEmpty())
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
        TablerIcon(Tabler.alert_triangle, null, tint = AppTheme.colors.warning)
        Column {
            Text(title, style = AppTheme.type.body.copy(fontWeight = FontWeight.SemiBold), color = AppTheme.colors.textPrimary)
            Text(text, style = AppTheme.type.small, color = AppTheme.colors.textSecondary)
        }
    }
}

@Composable
private fun JourneyPill(letter: String, label: String, onClick: () -> Unit) {
    Row(
        Modifier.pillWidth().heightIn(min = 38.dp).background(AppTheme.colors.backgroundSecondary, AppTheme.shapes.pill)
            .border(1.dp, AppTheme.colors.functionalTram.copy(alpha = 0.4f), AppTheme.shapes.pill)
            .clickable(role = Role.Button, onClickLabel = if (letter == "A") "Маршрут отсюда" else "Маршрут сюда", onClick = onClick)
            .padding(pillPadding()),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = pillArrangement(),
    ) {
        JourneyMarker(letter, size = 20)
        PillLabel(label, AppTheme.colors.textPrimary)
    }
}
