package ru.khudob1n.krasnodar.transport.ui.journey

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.draw.drawBehind
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import ru.khudob1n.krasnodar.transport.R
import ru.khudob1n.krasnodar.transport.domain.Leg
import ru.khudob1n.krasnodar.transport.domain.PlannedJourney
import ru.khudob1n.krasnodar.transport.domain.PlannedLeg
import ru.khudob1n.krasnodar.transport.domain.cityNow
import ru.khudob1n.krasnodar.transport.domain.formatClock
import ru.khudob1n.krasnodar.transport.domain.minutesOfDay
import ru.khudob1n.krasnodar.transport.domain.visibleLegIndices
import ru.khudob1n.krasnodar.transport.ui.components.PillButton
import ru.khudob1n.krasnodar.transport.ui.components.RouteBadge
import ru.khudob1n.krasnodar.transport.ui.components.TablerIcon
import ru.khudob1n.krasnodar.transport.ui.components.TransportType
import ru.khudob1n.krasnodar.transport.ui.components.color
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme
import kotlin.math.roundToInt

private val TransportType.nominative get() = when (this) { TransportType.Bus -> "Автобус"; TransportType.Troll -> "Троллейбус"; TransportType.Tram -> "Трамвай" }

/** Шаги навигатора: видимые этапы и последний - «вы на месте» (null). */
fun navigationSteps(journey: PlannedJourney): List<Int?> = visibleLegIndices(journey) + listOf(null)

/**
 * Навигатор «Поехали» (JourneyNavigator сайта): по одному этапу на экран с подробностями,
 * листается кнопками и свайпом; последний шаг - «вы на месте». Карта крупно показывает
 * текущий этап (MapScreen по journey.navStep).
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun JourneyNavigator(journey: JourneyController, planned: PlannedJourney) {
    val colors = AppTheme.colors
    val steps = remember(planned) { navigationSteps(planned) }
    val pager = rememberPagerState(initialPage = (journey.navStep ?: 0).coerceIn(0, steps.lastIndex)) { steps.size }
    val scope = rememberCoroutineScope()
    // Свайп - текущий шаг для карты; кнопки - листают страницы.
    LaunchedEffect(pager.currentPage) { journey.navStep = pager.currentPage }
    fun go(step: Int) { if (step in steps.indices) scope.launch { pager.animateScrollToPage(step) } }

    Column {
        Column(Modifier.padding(start = 16.dp, end = 64.dp, top = 4.dp, bottom = 8.dp)) {
            Text("В пути", Modifier.semantics { heading() }, style = AppTheme.type.h4, color = colors.textPrimary)
            Text("${journey.from?.title.orEmpty()} → ${journey.to?.title.orEmpty()}", style = AppTheme.type.small, color = colors.functional, maxLines = 2)
        }
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            Row(
                Modifier.clickable(role = Role.Button) { journey.navStep = null }.padding(vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                TablerIcon(R.drawable.tabler_arrow_left, null, Modifier.size(18.dp), tint = colors.textPrimary)
                Text("К вариантам", style = AppTheme.type.button, color = colors.textPrimary)
            }
            Box(Modifier.weight(1f))
            Text("Шаг ${pager.currentPage + 1} из ${steps.size}", Modifier.semantics { liveRegion = LiveRegionMode.Polite }, style = AppTheme.type.small, color = colors.functional)
        }
        // Точки шагов - нажатие переходит к шагу.
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            steps.indices.forEach { i ->
                Box(
                    Modifier.weight(1f).heightIn(min = 6.dp)
                        .background(if (i <= pager.currentPage) colors.textPrimary else colors.backgroundSecondary, RoundedCornerShape(3.dp))
                        .clickable(role = Role.Tab) { go(i) }
                        .semantics { contentDescription = "Шаг ${i + 1}" },
                )
            }
        }
        HorizontalPager(pager, Modifier.fillMaxWidth().weight(1f, fill = false), verticalAlignment = Alignment.Top) { page ->
            Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                when (val index = steps[page]) {
                    null -> FinishStep(planned, journey.to?.title.orEmpty())
                    else -> when (val step = planned.legs[index]) {
                        is PlannedLeg.WalkStep -> WalkStepView(step, index == planned.legs.lastIndex, journey::nameOf, nextRide(planned, index))
                        is PlannedLeg.RideStep -> RideStepView(step, journey::nameOf)
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (page > 0) PillButton("Назад", { go(page - 1) }, icon = R.drawable.tabler_chevron_left)
                    if (page < steps.lastIndex) PillButton("Дальше", { go(page + 1) }, icon = R.drawable.tabler_chevron_right)
                    else PillButton("Готово", { journey.navStep = null }, icon = R.drawable.tabler_flag)
                }
            }
        }
    }
}

private fun nextRide(planned: PlannedJourney, index: Int) = planned.legs.drop(index + 1).firstOrNull { it is PlannedLeg.RideStep } as? PlannedLeg.RideStep

@Composable
private fun Fact(title: String, value: String, warning: Boolean = false) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(title, style = AppTheme.type.small.copy(fontWeight = FontWeight.Medium), color = AppTheme.colors.functional)
        Text(value, style = AppTheme.type.body, color = if (warning) AppTheme.colors.warningText else AppTheme.colors.textPrimary)
    }
}

@Composable
private fun WalkStepView(step: PlannedLeg.WalkStep, isLast: Boolean, nameOf: (Long) -> String, next: PlannedLeg.RideStep?) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        TablerIcon(R.drawable.tabler_walk, null, Modifier.size(26.dp), tint = AppTheme.colors.textPrimary)
        Text(walkText(step.leg, isLast, nameOf), Modifier.semantics { heading() }, style = AppTheme.type.cardTitle.copy(fontSize = 20.sp), color = AppTheme.colors.textPrimary)
    }
    Fact("Пешком", "${formatMeters(step.leg.meters)} · ≈ ${formatDuration(step.leg.minutes)}")
    Fact("Время", "${formatClock(step.start)} – ${formatClock(step.end)}")
    if (next != null && !next.noService) {
        Text("Дальше: ${next.chosen.type.nominative.lowercase()} № ${next.chosen.number} в ${formatClock(next.departure)}", style = AppTheme.type.small, color = AppTheme.colors.functional)
    }
}

/** «Через N мин» до отправления; раз в 20 секунд пересчитывается. */
@Composable
private fun rememberNow(): Double {
    var now by remember { mutableDoubleStateOf(minutesOfDay(cityNow())) }
    LaunchedEffect(Unit) { while (true) { delay(20_000); now = minutesOfDay(cityNow()) } }
    return now
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RideStepView(step: PlannedLeg.RideStep, nameOf: (Long) -> String) {
    val colors = AppTheme.colors
    val now = rememberNow()
    val stops = step.chosen.stops.subList(step.chosenBoardIndex, step.chosenAlightIndex + 1)
    val count = stops.size - 1
    val left = (step.departure - now).roundToInt()
    val countdown = when { left < -1 -> "уже ушёл по расписанию"; left <= 0 -> "отправляется сейчас"; else -> "через ${formatDuration(left.toDouble())}" }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        RouteBadge(step.chosen.number, step.chosen.type)
        Text("${step.chosen.type.nominative} в сторону «${step.chosen.directionTo}»", Modifier.semantics { heading() }, style = AppTheme.type.cardTitle.copy(fontSize = 20.sp), color = colors.textPrimary)
    }
    Fact("Посадка", "«${nameOf(step.leg.from)}»")
    if (step.noService) Fact("Отправление", "Сегодня рейсов в эту сторону больше нет", warning = true)
    else Fact("Отправление", "${formatClock(step.departure)} · $countdown · ${step.source.note}", warning = left < -1)
    Fact("Выход", "«${nameOf(step.leg.to)}» — через $count ${stopsWord(count)}, около ${formatClock(step.arrival)}")
    val others = step.leg.alternatives.filter { it.pattern != step.chosen }
    if (others.isNotEmpty()) FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), itemVerticalAlignment = Alignment.CenterVertically) {
        Text(if (others.size == 1) "Подойдёт и" else "Подойдут и", style = AppTheme.type.small, color = colors.functional)
        others.forEach { RouteBadge(it.pattern.number, it.pattern.type, small = true) }
    }
    // Остановки по пути - на линии, как NavStops сайта: кружки с обводкой, у посадки и выхода
    // залитые и полужирные, справа пометки «посадка» и «выходите».
    Column {
        stops.forEachIndexed { i, id ->
            val edge = i == 0 || i == stops.lastIndex
            Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.width(12.dp).fillMaxHeight().drawBehind {
                    val x = size.width / 2
                    val top = if (i == 0) size.height / 2 else 0f
                    val bottom = if (i == stops.lastIndex) size.height / 2 else size.height
                    drawLine(colors.functionalTram, Offset(x, top), Offset(x, bottom), strokeWidth = 2.dp.toPx())
                }, contentAlignment = Alignment.Center) {
                    Box(
                        Modifier.size(8.dp)
                            .background(if (edge) colors.textPrimary else colors.backgroundSecondary, CircleShape)
                            .then(if (edge) Modifier else Modifier.border(2.dp, colors.functionalTram, CircleShape)),
                    )
                }
                Text(
                    nameOf(id),
                    Modifier.weight(1f).padding(start = 12.dp, top = 5.dp, bottom = 5.dp),
                    style = AppTheme.type.body.copy(fontSize = 14.sp, lineHeight = 20.sp, fontWeight = if (edge) FontWeight.SemiBold else FontWeight.Normal),
                    color = colors.textPrimary,
                )
                if (i == 0) Text("посадка", Modifier.padding(start = 8.dp), style = AppTheme.type.small, color = colors.functional)
                if (i == stops.lastIndex) Text("выходите", Modifier.padding(start = 8.dp), style = AppTheme.type.small, color = colors.functional)
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FinishStep(journey: PlannedJourney, toName: String) {
    val colors = AppTheme.colors
    val walk = journey.legs.sumOf { (it.leg as? Leg.WalkLeg)?.meters ?: 0.0 }
    val rides = journey.legs.filterIsInstance<PlannedLeg.RideStep>()
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(Modifier.size(64.dp).background(MARKER_B, CircleShape), contentAlignment = Alignment.Center) {
            TablerIcon(R.drawable.tabler_flag, null, Modifier.size(30.dp), tint = androidx.compose.ui.graphics.Color.White)
        }
        Text("Вы на месте", style = AppTheme.type.small, color = colors.functional)
        Text("«$toName»", Modifier.semantics { heading() }, style = AppTheme.type.cardTitle, color = colors.textPrimary)
        if (rides.isNotEmpty()) FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), itemVerticalAlignment = Alignment.CenterVertically) {
            Text("Катались на", style = AppTheme.type.small, color = colors.functional)
            rides.forEachIndexed { i, r ->
                if (i > 0) TablerIcon(R.drawable.tabler_chevron_right, null, Modifier.size(14.dp), tint = colors.functional)
                RouteBadge(r.chosen.number, r.chosen.type, small = true)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
            if (!journey.noServiceToday) {
                Fact("Прибытие", "≈ ${formatClock(journey.arrival)}")
                Fact("В пути", formatDuration(journey.arrival - journey.start))
            }
            Fact("Пешком", formatMeters(walk))
        }
    }
}
