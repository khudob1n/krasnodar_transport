package ru.khudob1n.krasnodar.transport.ui.cards

import ru.khudob1n.krasnodar.transport.map.rememberMarkerRenderer

import ru.khudob1n.krasnodar.transport.assets.Tabler

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import ru.khudob1n.krasnodar.transport.map.MarkerRenderer
import androidx.compose.foundation.border
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.khudob1n.krasnodar.transport.data.Direction
import ru.khudob1n.krasnodar.transport.data.Station
import ru.khudob1n.krasnodar.transport.data.Vehicle
import ru.khudob1n.krasnodar.transport.domain.plural
import ru.khudob1n.krasnodar.transport.ui.components.PillButton
import ru.khudob1n.krasnodar.transport.ui.components.PillGrid
import ru.khudob1n.krasnodar.transport.ui.components.ShareButton
import ru.khudob1n.krasnodar.transport.ui.components.ShareLinks
import ru.khudob1n.krasnodar.transport.ui.components.RouteBadge
import ru.khudob1n.krasnodar.transport.ui.components.TablerIcon
import ru.khudob1n.krasnodar.transport.ui.components.TransportType
import ru.khudob1n.krasnodar.transport.ui.components.color
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme
import kotlin.math.hypot

private val TransportType.nominative get() = when (this) { TransportType.Bus -> "автобус"; TransportType.Troll -> "троллейбус"; TransportType.Tram -> "трамвай" }
private val TransportType.about get() = when (this) { TransportType.Bus -> "об автобусе"; TransportType.Troll -> "о троллейбусе"; TransportType.Tram -> "о трамвае" }
private val TransportType.translucent: Color
    @Composable get() = when (this) {
        TransportType.Bus -> AppTheme.colors.busTranslucent
        TransportType.Troll -> AppTheme.colors.trollTranslucent
        TransportType.Tram -> AppTheme.colors.tramTranslucent
    }

/**
 * Карточка машины (components/Map/Vehicles/Sidebar сайта). direction - направление из
 * справочника; null - машина не на линии маршрута («едет по изменённому маршруту»).
 */
@Composable
fun VehicleCard(
    vehicle: Vehicle,
    type: TransportType,
    direction: Direction?,
    following: Boolean,
    onToggleFollow: () -> Unit,
    onStopClick: (Station) -> Unit,
) {
    val colors = AppTheme.colors
    val warning = direction == null
    val from = direction?.stations?.firstOrNull()?.name ?: vehicle.from
    val to = direction?.directionTo ?: vehicle.to
    var detailsOpened by remember { mutableStateOf(false) }

    Column(Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 16.dp)) {
        Row(Modifier.padding(top = 4.dp, end = 48.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            TransportTypeIcon(type, 28.dp)
            RouteBadge(vehicle.routeNumber, type, large = true)
            if (warning) TablerIcon(Tabler.alert_triangle, "Едет не по маршруту", Modifier.size(26.dp), tint = colors.warning)
        }

        Row(Modifier.padding(top = 18.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(Modifier.padding(top = 10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Box(Modifier.size(10.dp).border(2.dp, colors.functionalTram, CircleShape))
                Box(Modifier.width(2.dp).height(28.dp).background(colors.functionalTram))
                Box(Modifier.size(10.dp).background(if (warning) colors.warning else colors.functional, CircleShape))
            }
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(from, style = AppTheme.type.cardTitle, color = colors.textPrimary)
                Text(to, style = AppTheme.type.cardTitle, color = if (warning) colors.tram else colors.textPrimary)
                if (warning) Text("${type.nominative} едет по изменённому маршруту", style = AppTheme.type.small, color = colors.warningText)
            }
        }

        PillGrid(Modifier.padding(vertical = 16.dp)) {
            button {
                PillButton(
                    if (following) "Наблюдаю за движением" else "Наблюдать за движением",
                    onToggleFollow,
                    icon = Tabler.focus_2,
                    iconTint = if (following) type.color else null,
                )
            }
            button { ShareButton(ShareLinks.vehicle(vehicle.deviceCode), "${type.nominative.replaceFirstChar { it.uppercase() }} № ${vehicle.routeNumber} на карте транспорта") }
        }

        if (direction != null) {
            CardDivider()
            StopsList(vehicle, type, direction.stations, onStopClick)
        }

        CardDivider()
        Row(
            Modifier.fillMaxWidth().clickableNoIndication { detailsOpened = !detailsOpened }.expandState(detailsOpened).padding(vertical = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text("Подробнее ${type.about}", style = AppTheme.type.body.copy(fontWeight = FontWeight.Medium), color = colors.textPrimary)
            TablerIcon(Tabler.chevron_down, null, Modifier.size(18.dp).rotate(if (detailsOpened) 180f else 0f), tint = colors.functional)
        }
        AnimatedVisibility(detailsOpened) {
            Column(Modifier.padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                if (vehicle.operator.isNotBlank()) Detail("Перевозчик", vehicle.operator)
                if (vehicle.boardNumber.isNotBlank()) Detail("Бортномер", vehicle.boardNumber)
                if (vehicle.model.isNotBlank()) Detail("Модель", vehicle.model)
                if (vehicle.gosNum.isNotBlank()) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Caption("Госномер")
                        Plate(vehicle.gosNum)
                    }
                }
            }
        }
    }
}

@Composable
private fun Caption(text: String) =
    Text(text.uppercase(), style = AppTheme.type.small.copy(fontWeight = FontWeight.Medium, letterSpacing = 0.6.sp), color = AppTheme.colors.functional)

@Composable
private fun Detail(title: String, value: String) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Caption(title)
        Text(value, style = AppTheme.type.caption, color = AppTheme.colors.textPrimary)
    }
}

/** Госномер как табличка: «ак 827 | 23 RUS» (сайт рисует так же). */
@Composable
private fun Plate(number: String) {
    val parts = number.lowercase().split(' ').filter(String::isNotBlank)
    val region = parts.lastOrNull()?.takeIf { it.all(Char::isDigit) }
    val main = (if (region != null) parts.dropLast(1) else parts).joinToString(" ")
    Row(
        Modifier.border(2.dp, AppTheme.colors.textPrimary, RoundedCornerShape(6.dp)),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(main, Modifier.padding(horizontal = 10.dp, vertical = 4.dp), style = AppTheme.type.caption.copy(fontWeight = FontWeight.SemiBold, fontSize = 22.sp), color = AppTheme.colors.textPrimary)
        if (region != null) {
            Box(Modifier.width(2.dp).height(34.dp).background(AppTheme.colors.textPrimary))
            Column(Modifier.padding(horizontal = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(region, style = AppTheme.type.body.copy(fontWeight = FontWeight.SemiBold), color = AppTheme.colors.textPrimary)
                Text("RUS", style = AppTheme.type.small.copy(fontSize = 9.sp), color = AppTheme.colors.textPrimary)
            }
        }
    }
}

/**
 * Остановки машины (MapVehiclesSidebar сайта): первая и пройденные - на бледной линии цвета
 * транспорта, от текущей (ближайшей к машине, на ней маркер машины) до конечной - на яркой.
 * Пройденные и хвост после трёх следующих свёрнуты в «N остановок» с точками на линии.
 */
@Composable
private fun StopsList(vehicle: Vehicle, type: TransportType, stations: List<Station>, onStopClick: (Station) -> Unit) {
    if (stations.isEmpty()) return
    val nearest = stations.indices.minBy { hypot(stations[it].lat - vehicle.lat, (stations[it].lng - vehicle.lng) * 0.71) }
    val passed = stations.subList(minOf(1, nearest), nearest)
    val lastNearest = minOf(nearest + 4, stations.lastIndex)
    val ahead = stations.subList(nearest + 1, maxOf(nearest + 1, lastNearest))
    val beforeEnd = stations.subList(maxOf(lastNearest, nearest + 1), stations.lastIndex.coerceAtLeast(maxOf(lastNearest, nearest + 1)))
    var passedOpened by remember(vehicle.deviceCode) { mutableStateOf(false) }
    var restOpened by remember(vehicle.deviceCode) { mutableStateOf(false) }
    val color = type.color
    val faded = type.translucent
    val atEnd = nearest == stations.lastIndex

    Column(Modifier.padding(vertical = 4.dp)) {
        if (nearest != 0) StopRow(stations.first().name, null, faded, { Bullet(faded, big = true) }, muted = true) { onStopClick(stations.first()) }
        if (passed.isNotEmpty()) {
            HiddenStops(passed.size, passedOpened, faded) { passedOpened = !passedOpened }
            if (passedOpened) passed.forEach { StopRow(it.name, faded, faded, { Bullet(faded) }, muted = true) { onStopClick(it) } }
        }
        StopRow(stations[nearest].name, if (nearest != 0) faded else null, if (atEnd) null else color, { VehicleMarker(type) }) { onStopClick(stations[nearest]) }
        ahead.forEach { StopRow(it.name, color, color, { Bullet(color) }) { onStopClick(it) } }
        if (beforeEnd.isNotEmpty()) {
            HiddenStops(beforeEnd.size, restOpened, color) { restOpened = !restOpened }
            if (restOpened) beforeEnd.forEach { StopRow(it.name, color, color, { Bullet(color) }) { onStopClick(it) } }
        }
        if (!atEnd) StopRow(stations.last().name, color, null, { Bullet(color, big = true) }) { onStopClick(stations.last()) }
    }
}

/** Столбик линии: верхняя половина цвета above, нижняя - below (null - линии нет). */
private fun Modifier.rail(above: Color?, below: Color?) = drawBehind {
    val w = 6.dp.toPx()
    val x = size.width / 2 - w / 2
    above?.let { drawRect(it, Offset(x, 0f), Size(w, size.height / 2)) }
    below?.let { drawRect(it, Offset(x, size.height / 2), Size(w, size.height / 2)) }
}

@Composable
private fun StopRow(
    name: String,
    above: Color?,
    below: Color?,
    marker: @Composable () -> Unit,
    muted: Boolean = false,
    onClick: () -> Unit,
) {
    Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min).clickableNoIndication(onClick = onClick), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.width(10.dp).fillMaxHeight().rail(above, below), contentAlignment = Alignment.Center) { marker() }
        Text(
            name,
            Modifier.weight(1f).padding(start = 16.dp).padding(vertical = 14.dp),
            style = AppTheme.type.caption,
            color = if (muted) AppTheme.colors.functional else AppTheme.colors.textPrimary,
        )
    }
}

/** Кружок остановки: 12 с обводкой 3, у первой и конечной - 16 с обводкой 4. */
@Composable
private fun Bullet(color: Color, big: Boolean = false) {
    Box(
        Modifier.requiredSize(if (big) 16.dp else 12.dp)
            .background(AppTheme.colors.backgroundPrimary, CircleShape)
            .border(if (big) 4.dp else 3.dp, color, CircleShape),
    )
}

/** Маркер машины - капля с пиктограммой остриём вниз, в 0,6 от размера на карте. */
@Composable
private fun VehicleMarker(type: TransportType) {
    val renderer = rememberMarkerRenderer()
    val dark = AppTheme.colors.isDark
    val drop = remember(type, dark, renderer) { renderer.arrow(type, stale = false, dark = dark) }
    // Острие капли (12 dp ниже центра после поворота) - на уровне остановки.
    Box(Modifier.requiredSize(34.dp).offset(y = (-12).dp), contentAlignment = Alignment.Center) {
        Image(drop, null, Modifier.fillMaxSize().rotate(180f))
        TransportTypeIcon(type, 14.dp)
    }
}

@Composable
private fun HiddenStops(count: Int, opened: Boolean, color: Color, onToggle: () -> Unit) {
    Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min).clickableNoIndication(onClick = onToggle).expandState(opened), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.width(10.dp).fillMaxHeight().rail(color, color), contentAlignment = Alignment.Center) {
            // Точки на линии - по одной на остановку, не больше 10 (getPointsRow сайта).
            if (!opened) Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                repeat(minOf(count, 10)) { Box(Modifier.size(3.dp).background(AppTheme.colors.backgroundPrimary, CircleShape)) }
            }
        }
        Row(Modifier.padding(start = 16.dp).padding(vertical = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("$count ${plural(count, "остановка", "остановки", "остановок")}", style = AppTheme.type.caption, color = AppTheme.colors.functional)
            TablerIcon(Tabler.chevron_down, null, Modifier.size(18.dp).rotate(if (opened) 180f else 0f), tint = AppTheme.colors.functional)
        }
    }
}
