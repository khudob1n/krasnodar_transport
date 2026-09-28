package ru.khudob1n.krasnodar.transport.ui.cards

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.khudob1n.krasnodar.transport.R
import ru.khudob1n.krasnodar.transport.data.ScheduleTrip
import ru.khudob1n.krasnodar.transport.domain.cityNow
import ru.khudob1n.krasnodar.transport.domain.dayTypeOf
import ru.khudob1n.krasnodar.transport.ui.components.RouteBadge
import ru.khudob1n.krasnodar.transport.ui.components.TablerIcon
import ru.khudob1n.krasnodar.transport.ui.components.TransportType
import ru.khudob1n.krasnodar.transport.ui.components.color
import ru.khudob1n.krasnodar.transport.data.transportOfRu
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme

/** Номера маршрутов по-человечески: 2, 2Е, 10 (localeCompare с numeric у сайта). */
private val routeOrder = Comparator<String> { a, b ->
    val na = a.takeWhile(Char::isDigit).toIntOrNull()
    val nb = b.takeWhile(Char::isDigit).toIntOrNull()
    when {
        na != null && nb != null && na != nb -> na.compareTo(nb)
        else -> a.compareTo(b)
    }
}

private fun minutesOf(time: String) = time.substringBefore(':').toInt() * 60 + time.substringAfter(':').take(2).toInt()

/**
 * Полное расписание остановки - MapStopSchedule сайта: сверху «Маршрут» - номера по видам
 * транспорта, дальше будни / выходные, «В сторону» (если направлений несколько) и сетка
 * «час - минуты» с «Скрыть прошедшие». Выбранные вкладки - цветом вида транспорта маршрута.
 */
@Composable
fun StopSchedule(trips: List<ScheduleTrip>) {
    val colors = AppTheme.colors
    val today = remember { dayTypeOf(cityNow()) }
    var dayType by remember { mutableStateOf(today) }
    var selectedRoute by remember { mutableStateOf<Pair<String, String>?>(null) }
    var selectedDirection by remember { mutableStateOf<String?>(null) }
    var hidePast by remember { mutableStateOf(false) }

    val dayTrips = trips.filter { it.dayType == dayType }
    // (вид, номер) маршрутов этого дня, по номеру; группы видов - в порядке первого номера.
    val routes = dayTrips.map { it.routeType to it.routeNumber }.distinct().sortedWith(compareBy(routeOrder) { it.second })
    val groups = routes.groupBy { it.first }
    val route = selectedRoute?.takeIf { it in routes } ?: routes.firstOrNull()
    val directions = dayTrips.filter { (it.routeType to it.routeNumber) == route }.map { it.toStation }.distinct()
    val direction = selectedDirection?.takeIf { it in directions } ?: directions.firstOrNull()
    val times = dayTrips.filter { (it.routeType to it.routeNumber) == route && it.toStation == direction }.map { it.time }
    val accent = route?.let { transportOfRu(it.first) }?.color ?: colors.functional

    Column(Modifier.padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        if (routes.isNotEmpty()) Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Label("Маршрут")
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                for ((ruType, list) in groups) {
                    val type = transportOfRu(ruType)
                    val groupActive = list.any { it == route }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                        if (type != null) Box(Modifier.size(26.dp).alpha(if (groupActive) 1f else 0.48f), contentAlignment = Alignment.Center) {
                            TransportTypeIcon(type, 23.dp)
                        }
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            for (r in list) {
                                val active = r == route
                                val lift by animateFloatAsState(if (active) -1f else 0f, label = "lift")
                                Box(
                                    Modifier
                                        .graphicsLayer { translationY = lift * density }
                                        .alpha(if (active) 1f else 0.48f)
                                        .clickable(role = Role.Tab, onClickLabel = "Расписание маршрута ${r.second}") { selectedRoute = r }
                                        .semantics { selected = active }
                                        .padding(3.dp),
                                ) {
                                    if (type != null) RouteBadge(r.second, type, small = true) else Text(r.second, style = AppTheme.type.body)
                                }
                            }
                        }
                    }
                }
            }
        }

        Tabs(listOf("будни" to "Будни", "выходные" to "Выходные"), dayType, accent) { dayType = it }

        // Направлений несколько - кнопками под подписью «В сторону»; одно - текстом.
        if (directions.size > 1) Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Label("В сторону")
            Tabs(directions.map { it to it }, direction, accent) { selectedDirection = it }
        } else if (direction != null) {
            Text("В сторону «$direction»", style = AppTheme.type.small.copy(lineHeight = 18.sp), color = colors.textSecondary)
        }

        ScheduleGrid(times, hidePast, { hidePast = it }, canHidePast = dayType == today)
    }
}

@Composable
private fun Label(text: String) = Text(text, style = AppTheme.type.small.copy(lineHeight = 18.sp), color = AppTheme.colors.textSecondary)

/** Вкладки (ScheduleControls.Tabs сайта): серые плашки, выбранная - залита цветом вида транспорта. */
@Composable
private fun Tabs(items: List<Pair<String, String>>, selected: String?, accent: Color, onSelect: (String) -> Unit) {
    val colors = AppTheme.colors
    Row(Modifier.horizontalScroll(rememberScrollState()).padding(bottom = 2.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        for ((value, title) in items) {
            val active = value == selected
            Text(
                title,
                Modifier
                    .background(if (active) accent else colors.backgroundSecondary, RoundedCornerShape(10.dp))
                    .clickable(role = Role.Tab) { onSelect(value) }
                    .semantics { this.selected = active }
                    .padding(horizontal = 13.dp, vertical = 9.dp),
                style = AppTheme.type.body.copy(fontSize = 14.sp, lineHeight = 18.sp),
                color = if (active) Color.White else colors.textSecondary,
            )
        }
    }
}

/**
 * Сетка «час - минуты» (ScheduleGrid сайта): плашка часа 54 во всю высоту своих минут,
 * минуты - колонками не уже 32, «Скрыть прошедшие» - только для сегодняшнего дня.
 */
@Composable
private fun ScheduleGrid(times: List<String>, hidePast: Boolean, onHidePastChange: (Boolean) -> Unit, canHidePast: Boolean) {
    val colors = AppTheme.colors
    val now = remember { cityNow().let { it.hour * 60 + it.minute } }
    val rows = times.distinct().sortedBy(::minutesOf)
        .filter { !hidePast || !canHidePast || minutesOf(it) >= now }
        .groupBy { it.substringBefore(':').padStart(2, '0') }
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        val turn by animateFloatAsState(if (hidePast) 0f else 180f, label = "chevron")
        Row(
            Modifier
                .alpha(if (canHidePast) 1f else 0.45f)
                .clickable(enabled = canHidePast, role = Role.Button) { onHidePastChange(!hidePast) }
                .padding(horizontal = 6.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(if (hidePast) "Показать прошедшие" else "Скрыть прошедшие", style = AppTheme.type.small.copy(lineHeight = 18.sp), color = colors.textSecondary)
            TablerIcon(R.drawable.tabler_chevron_down, null, Modifier.size(16.dp).rotate(turn), tint = colors.functionalTram)
        }
        if (rows.isEmpty()) {
            Text("Нет данных о расписании", style = AppTheme.type.body.copy(fontSize = 14.sp, lineHeight = 20.sp), color = colors.textSecondary)
        } else Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            for ((hour, list) in rows) {
                Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Box(
                        Modifier.width(54.dp).fillMaxHeight().heightIn(min = 42.dp).background(colors.backgroundSecondary, RoundedCornerShape(10.dp)).padding(top = 9.dp),
                        contentAlignment = Alignment.TopCenter,
                    ) {
                        Text(hour, style = AppTheme.type.body.copy(fontSize = 19.sp, lineHeight = 24.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold), color = colors.textPrimary)
                    }
                    MinutesGrid(list.map { it.substringAfter(':').take(2) }, Modifier.weight(1f))
                }
            }
        }
    }
}

/**
 * grid-template-columns: repeat(auto-fill, minmax(32px, 1fr)), промежутки 8 по вертикали и 10
 * по горизонтали. Своя раскладка, а не BoxWithConstraints: строка часа меряется по высоте
 * минут (IntrinsicSize), а подкомпоновка этого не умеет.
 */
@Composable
private fun MinutesGrid(minutes: List<String>, modifier: Modifier) {
    Layout(
        content = {
            for (m in minutes) Text(
                m,
                style = AppTheme.type.body.copy(fontSize = 16.sp, lineHeight = 22.sp),
                color = AppTheme.colors.textSecondary,
                textAlign = TextAlign.Center,
            )
        },
        modifier = modifier.padding(vertical = 10.dp),
    ) { measurables, constraints ->
        val gapX = 10.dp.roundToPx()
        val gapY = 8.dp.roundToPx()
        val min = 32.dp.roundToPx()
        val width = if (constraints.hasBoundedWidth) constraints.maxWidth else (min + gapX) * 8
        val columns = ((width + gapX) / (min + gapX)).coerceAtLeast(1)
        val cell = (width - gapX * (columns - 1)) / columns
        val placeables = measurables.map { it.measure(Constraints.fixedWidth(cell)) }
        val rowHeight = placeables.maxOfOrNull { it.height } ?: 0
        val rows = (placeables.size + columns - 1) / columns
        val height = if (rows == 0) 0 else rows * rowHeight + (rows - 1) * gapY
        layout(width, height) {
            placeables.forEachIndexed { i, p -> p.place((i % columns) * (cell + gapX), (i / columns) * (rowHeight + gapY)) }
        }
    }
}
