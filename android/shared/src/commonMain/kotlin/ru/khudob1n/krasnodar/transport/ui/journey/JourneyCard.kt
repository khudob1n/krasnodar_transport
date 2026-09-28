package ru.khudob1n.krasnodar.transport.ui.journey

import ru.khudob1n.krasnodar.transport.assets.Tabler

import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import ru.khudob1n.krasnodar.transport.domain.Leg
import ru.khudob1n.krasnodar.transport.domain.MIN_WALK_TO_SHOW_M
import ru.khudob1n.krasnodar.transport.domain.PlannedJourney
import ru.khudob1n.krasnodar.transport.domain.PlannedLeg
import ru.khudob1n.krasnodar.transport.domain.cityNow
import ru.khudob1n.krasnodar.transport.domain.formatClock
import ru.khudob1n.krasnodar.transport.domain.minutesOfDay
import ru.khudob1n.krasnodar.transport.domain.plural
import ru.khudob1n.krasnodar.transport.domain.visibleLegIndices
import ru.khudob1n.krasnodar.transport.ui.cards.CardDivider
import ru.khudob1n.krasnodar.transport.ui.components.PillButton
import ru.khudob1n.krasnodar.transport.ui.components.PillGrid
import ru.khudob1n.krasnodar.transport.ui.components.ShareButton
import ru.khudob1n.krasnodar.transport.ui.components.RouteBadge
import ru.khudob1n.krasnodar.transport.ui.components.TablerIcon
import ru.khudob1n.krasnodar.transport.ui.components.color
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme
import ru.khudob1n.krasnodar.transport.ui.theme.fixedSp

/** Метки точек «А» и «Б» - те же цвета, что у сайта (JourneyFieldMarker). */
val MARKER_A = Color(0xFF2E7D32)
val MARKER_B = Color(0xFFD32F2F)

enum class JourneyField { From, To }

@Composable
fun JourneyMarker(letter: String, size: Int = 22) {
    Box(Modifier.size(size.dp).background(if (letter == "A") MARKER_A else MARKER_B, CircleShape), contentAlignment = Alignment.Center) {
        Text(letter, style = AppTheme.type.small.copy(fontWeight = FontWeight.Bold, fontSize = fixedSp(size * 0.55f), lineHeight = fixedSp(size * 0.7f)), color = Color.White)
    }
}

/**
 * Панель «Маршрут» (MapJourneySidebar сайта): откуда и куда, варианты с пересадками, шаги
 * выбранного. Поле открывает выбор точки (JourneyPicker).
 */
@Composable
fun JourneyCard(journey: JourneyController, onEditField: (JourneyField) -> Unit, note: String? = null) {
    val colors = AppTheme.colors
    val navigating = journey.navStep?.let { journey.journeys.getOrNull(journey.selected) }
    if (navigating != null) {
        JourneyNavigator(journey, navigating)
        return
    }
    // Отправления посчитаны на момент поиска - если панель висит открытой, пересчитываем.
    LaunchedEffect(journey.status, journey.from, journey.to) {
        if (journey.status != JourneyStatus.Done) return@LaunchedEffect
        while (true) { delay(60_000); journey.refresh() }
    }
    Column(Modifier.verticalScroll(rememberScrollState())) {
        Text("Маршрут", Modifier.padding(start = 16.dp, end = 64.dp, top = 4.dp, bottom = 12.dp), style = AppTheme.type.h4, color = colors.textPrimary)
        Row(Modifier.padding(start = 16.dp, end = 8.dp, bottom = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Field("A", "Откуда", journey.from?.title, { onEditField(JourneyField.From) }, { journey.changeFrom(null) })
                Field("B", "Куда", journey.to?.title, { onEditField(JourneyField.To) }, { journey.changeTo(null) })
            }
            Box(
                Modifier.size(44.dp).clickable(role = Role.Button, enabled = journey.from != null || journey.to != null, onClick = journey::swap)
                    .semantics { contentDescription = "Поменять местами «Откуда» и «Куда»" },
                contentAlignment = Alignment.Center,
            ) { TablerIcon(Tabler.arrows_up_down, null, Modifier.size(20.dp), tint = colors.textSecondary) }
        }
        if (note != null) Text(note, Modifier.padding(start = 16.dp, end = 16.dp, bottom = 12.dp), style = AppTheme.type.small.copy(fontSize = 14.sp, lineHeight = 20.sp), color = colors.functional)
        CardDivider()

        val note = AppTheme.type.small.copy(fontSize = 14.sp, lineHeight = 20.sp)
        val padded = Modifier.padding(16.dp)
        when {
            journey.samePoints -> Text("Откуда и куда — одно и то же место.", padded, style = note, color = colors.functional)
            journey.status == JourneyStatus.Loading -> Text("Ищем варианты…", padded, style = note, color = colors.functional)
            journey.status == JourneyStatus.Error -> Text("Не удалось загрузить данные о маршрутах. Попробуйте ещё раз чуть позже.", padded, style = note, color = colors.functional)
            journey.status == JourneyStatus.Done && journey.journeys.isEmpty() -> {
                val max = journey.maxTransfers
                Text(
                    (if (max == 0) "Не нашли, как доехать без пересадок." else "Не нашли вариантов, где пересадок не больше $max.") +
                        " Попробуйте соседнюю остановку или место" + (if (max < 3) " — или разрешите больше пересадок в настройках." else "."),
                    padded, style = note, color = colors.functional,
                )
            }
        }

        if (journey.status == JourneyStatus.Done && journey.journeys.isNotEmpty()) {
            journey.journeys.forEachIndexed { index, item ->
                Option(item, index == journey.selected, { journey.select(index) }, journey::nameOf, journey.to?.title.orEmpty(), onGo = { journey.navStep = 0 })
                CardDivider()
            }
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                val ago = journey.plannedAt?.let { minutesOfDay(cityNow()) - minutesOfDay(it) } ?: 0.0
                Text(
                    "Время в пути примерное: пробки и задержки не учтены." + if (ago >= 1) " Посчитано ${ago.toInt()} мин назад." else "",
                    style = note, color = colors.functional,
                )
                PillGrid {
                    journey.shareUrl()?.let { url -> button { ShareButton(url, "Маршрут на карте транспорта") } }
                    button { PillButton("Обновить", journey::refresh, icon = Tabler.refresh) }
                }
            }
        }
    }
}

@Composable
private fun Field(letter: String, label: String, value: String?, onEdit: () -> Unit, onClear: () -> Unit) {
    val colors = AppTheme.colors
    Row(
        Modifier.fillMaxWidth().heightIn(min = 48.dp).background(colors.backgroundSecondary, RoundedCornerShape(12.dp))
            .clickable(role = Role.Button, onClickLabel = "Изменить", onClick = onEdit)
            // Крестик внутри поля с TalkBack - действие «Очистить» у самого поля.
            .clearAndSetSemantics {
                contentDescription = if (value != null) "$label: $value" else label
                role = Role.Button
                if (value != null) customActions = listOf(CustomAccessibilityAction("Очистить") { onClear(); true })
            }
            .padding(start = 12.dp, end = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        JourneyMarker(letter)
        Column(Modifier.weight(1f).padding(vertical = 6.dp)) {
            if (value != null) {
                Text(label, style = AppTheme.type.small.copy(fontSize = 12.sp, lineHeight = 14.sp), color = colors.functional)
                Text(value, style = AppTheme.type.body, color = colors.textPrimary, maxLines = 2)
            } else {
                Text(label, style = AppTheme.type.body, color = colors.functional)
            }
        }
        if (value != null) {
            Box(
                Modifier.size(40.dp).clickable(role = Role.Button, onClick = onClear).semantics { contentDescription = "Очистить поле «$label»" },
                contentAlignment = Alignment.Center,
            ) { TablerIcon(Tabler.x, null, Modifier.size(18.dp), tint = colors.functional) }
        }
    }
}

private fun PlannedJourney.walkMeters() = legs.sumOf { (it.leg as? Leg.WalkLeg)?.meters ?: 0.0 }

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Option(journey: PlannedJourney, selected: Boolean, onSelect: () -> Unit, nameOf: (Long) -> String, toName: String, onGo: () -> Unit) {
    val colors = AppTheme.colors
    val transfers = journey.itinerary.rides - 1
    val walk = journey.walkMeters()
    val firstRide = journey.legs.firstOrNull { it is PlannedLeg.RideStep } as? PlannedLeg.RideStep
    val note = AppTheme.type.small.copy(fontSize = 14.sp, lineHeight = 20.sp)
    Column(Modifier.fillMaxWidth().background(if (selected) colors.backgroundSecondary.copy(alpha = 0.5f) else Color.Transparent)) {
        Column(
            Modifier.fillMaxWidth().clickable(role = Role.Button, onClick = onSelect)
                .semantics { stateDescription = if (selected) "Открыт" else "Свёрнут" }.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    if (journey.noServiceToday) "≈ ${formatDuration(journey.itinerary.estimatedMinutes)}" else formatDuration(journey.arrival - journey.start),
                    style = AppTheme.type.cardTitle, color = colors.textPrimary,
                )
                if (!journey.noServiceToday) Text("${formatClock(journey.start)} – ${formatClock(journey.arrival)}", style = AppTheme.type.body, color = colors.textSecondary)
            }
            // Шаги кратко: пешком / номер маршрута (+ параллельные), через шеврон.
            FlowRow(verticalArrangement = Arrangement.spacedBy(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp), itemVerticalAlignment = Alignment.CenterVertically) {
                visibleLegIndices(journey).forEachIndexed { i, index ->
                    if (i > 0) TablerIcon(Tabler.chevron_right, null, Modifier.size(14.dp), tint = colors.functional)
                    when (val step = journey.legs[index]) {
                        is PlannedLeg.WalkStep -> TablerIcon(Tabler.walk, "Пешком ${formatMeters(step.leg.meters)}", Modifier.size(18.dp), tint = colors.textSecondary)
                        is PlannedLeg.RideStep -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            RouteBadge(step.chosen.number, step.chosen.type, small = true)
                            if (step.leg.alternatives.size > 1) Text("+${step.leg.alternatives.size - 1}", style = note, color = colors.functional)
                        }
                    }
                }
            }
            Text(
                buildString {
                    when {
                        transfers < 0 -> append("Пешком ${formatMeters(walk)}, без транспорта")
                        transfers == 0 -> append("Без пересадок")
                        else -> append("$transfers ${plural(transfers, "пересадка", "пересадки", "пересадок")}")
                    }
                    if (transfers >= 0 && walk >= MIN_WALK_TO_SHOW_M) append(" · пешком ${formatMeters(walk)}")
                    if (firstRide != null && !journey.noServiceToday) append(" · отправление в ${formatClock(firstRide.departure)}")
                },
                style = note, color = colors.functional,
            )
            if (journey.noServiceToday) Text("Сегодня по этому варианту рейсов уже нет", style = note, color = colors.warningText)
        }
        if (selected) {
            Steps(journey, nameOf, toName)
            // «Поехали» - цветом первой поездки (journeyAccentColor сайта).
            val accent = (journey.legs.firstOrNull { it is PlannedLeg.RideStep } as? PlannedLeg.RideStep)?.chosen?.type?.color ?: colors.walk
            Row(
                Modifier.padding(start = 16.dp, bottom = 16.dp).heightIn(min = 44.dp).background(accent, RoundedCornerShape(14.dp))
                    .clickable(role = Role.Button, onClick = onGo).padding(horizontal = 18.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                TablerIcon(Tabler.player_play_filled, null, Modifier.size(18.dp), tint = Color.White)
                Text("Поехали", style = AppTheme.type.button.copy(fontWeight = FontWeight.SemiBold), color = Color.White)
            }
        }
    }
}

/** Шаги выбранного варианта: слева значок (пешком / номер), справа что делать. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Steps(journey: PlannedJourney, nameOf: (Long) -> String, toName: String) {
    val colors = AppTheme.colors
    val note = AppTheme.type.small.copy(fontSize = 14.sp, lineHeight = 20.sp)
    val indices = visibleLegIndices(journey)
    Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        indices.forEachIndexed { i, index ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                when (val step = journey.legs[index]) {
                    is PlannedLeg.WalkStep -> {
                        Box(Modifier.width(44.dp), contentAlignment = Alignment.Center) {
                            TablerIcon(Tabler.walk, null, Modifier.size(20.dp), tint = colors.textSecondary)
                        }
                        Column(Modifier.weight(1f)) {
                            Text(walkText(step.leg, i == indices.lastIndex, nameOf), style = AppTheme.type.body, color = colors.textPrimary)
                            Text("≈ ${formatDuration(step.leg.minutes)}", style = note, color = colors.functional)
                        }
                    }
                    is PlannedLeg.RideStep -> {
                        Box(Modifier.width(44.dp), contentAlignment = Alignment.TopCenter) { RouteBadge(step.chosen.number, step.chosen.type, small = true) }
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            val count = step.chosenAlightIndex - step.chosenBoardIndex
                            val wait = step.departure - step.ready
                            Text("«${nameOf(step.leg.from)}» → «${nameOf(step.leg.to)}»", style = AppTheme.type.body.copy(fontWeight = FontWeight.Medium), color = colors.textPrimary)
                            Text("в сторону «${step.chosen.directionTo}» · $count ${stopsWord(count)} · ≈ ${formatDuration(step.arrival - step.departure)}", style = note, color = colors.functional)
                            if (step.noService) Text("Сегодня рейсов в эту сторону больше нет", style = note, color = colors.warningText)
                            else Text(
                                "Отправление в ${formatClock(step.departure)}" + (if (wait >= 1) ", ждать ${formatDuration(wait)}" else "") + " · ${step.source.note}",
                                style = note, color = colors.functional,
                            )
                            val others = step.leg.alternatives.filter { it.pattern != step.chosen }
                            if (others.isNotEmpty()) FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), itemVerticalAlignment = Alignment.CenterVertically) {
                                Text(if (others.size == 1) "Подойдёт и" else "Подойдут и", style = note, color = colors.functional)
                                others.forEach { RouteBadge(it.pattern.number, it.pattern.type, small = true) }
                            }
                        }
                    }
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.width(44.dp), contentAlignment = Alignment.Center) { JourneyMarker("B") }
            Text(
                if (journey.noServiceToday) "«$toName»" else "«$toName» около ${formatClock(journey.arrival)}",
                Modifier.weight(1f), style = AppTheme.type.body, color = colors.textPrimary,
            )
        }
    }
}
