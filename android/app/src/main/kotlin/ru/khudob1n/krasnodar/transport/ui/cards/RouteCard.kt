package ru.khudob1n.krasnodar.transport.ui.cards

import androidx.compose.foundation.background
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
import androidx.compose.ui.unit.dp
import ru.khudob1n.krasnodar.transport.R
import ru.khudob1n.krasnodar.transport.data.Direction
import ru.khudob1n.krasnodar.transport.data.RouteStops
import ru.khudob1n.krasnodar.transport.data.Station
import ru.khudob1n.krasnodar.transport.domain.plural
import ru.khudob1n.krasnodar.transport.ui.components.RouteBadge
import ru.khudob1n.krasnodar.transport.ui.components.SiteIcon
import ru.khudob1n.krasnodar.transport.ui.components.TablerIcon
import ru.khudob1n.krasnodar.transport.ui.components.TransportType
import ru.khudob1n.krasnodar.transport.ui.components.color
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme

/**
 * Карточка маршрута (MapRouteSidebar сайта): направление «откуда → куда», обратное направление
 * одной кнопкой, остальные подмаршруты списком, остановки - первая, свёрнутые, конечная.
 */
@Composable
fun RouteCard(
    route: RouteStops,
    type: TransportType,
    direction: Direction,
    onSelectDirection: (Direction) -> Unit,
    onStopClick: (Station) -> Unit,
    favoriteButton: @Composable () -> Unit = {},
) {
    val colors = AppTheme.colors
    val others = route.directions.filter { it.subrouteId != direction.subrouteId }
    var directionsOpened by remember(route.id) { mutableStateOf(false) }
    var stopsOpened by remember(direction.subrouteId) { mutableStateOf(false) }
    val stations = direction.stations
    val first = stations.firstOrNull()?.name ?: route.fromStation

    Column(Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 16.dp)) {
        Row(Modifier.padding(top = 4.dp, end = 48.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            TransportTypeIcon(type, 28.dp)
            RouteBadge(route.number, type, large = true)
            favoriteButton()
        }

        Row(Modifier.padding(top = 18.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(Modifier.padding(top = 10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(Modifier.size(10.dp).border(2.dp, colors.functionalTram, CircleShape))
                    Box(Modifier.width(2.dp).height(28.dp).background(colors.functionalTram))
                    Box(Modifier.size(10.dp).background(colors.functional, CircleShape))
                }
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(first, style = AppTheme.type.cardTitle, color = colors.textPrimary)
                    Text(direction.directionTo, style = AppTheme.type.cardTitle, color = colors.textPrimary)
                }
            }
            // Обратное направление - обычная пара «туда-обратно»: переключаем одной кнопкой.
            if (others.size == 1) {
                Box(Modifier.size(44.dp).clickableNoIndication { onSelectDirection(others.first()) }, contentAlignment = Alignment.Center) {
                    SiteIcon("swap", 24.dp, "Обратное направление", tint = colors.textPrimary)
                }
            }
        }

        if (others.size > 1) {
            Row(
                Modifier.fillMaxWidth().clickableNoIndication { directionsOpened = !directionsOpened }.expandState(directionsOpened).padding(vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text("Ещё ${others.size} ${plural(others.size, "подмаршрут", "подмаршрута", "подмаршрутов")}", style = AppTheme.type.caption, color = colors.textPrimary)
                TablerIcon(R.drawable.tabler_chevron_down, null, Modifier.size(20.dp).rotate(if (directionsOpened) 180f else 0f), tint = colors.functional)
            }
            if (directionsOpened) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(bottom = 12.dp)) {
                    others.forEach { d ->
                        Text(
                            "${d.stations.firstOrNull()?.name ?: ""} — ${d.directionTo}",
                            Modifier.fillMaxWidth().clickableNoIndication { onSelectDirection(d); directionsOpened = false },
                            style = AppTheme.type.body,
                            color = colors.textSecondary,
                        )
                    }
                }
            }
        }

        CardDivider()
        Column(Modifier.padding(vertical = 12.dp)) {
            val color = type.color
            if (stations.isNotEmpty()) RouteStop(stations.first(), color, big = true, onStopClick)
            val middle = if (stations.size > 2) stations.subList(1, stations.lastIndex) else emptyList()
            if (middle.isNotEmpty()) {
                Row(Modifier.clickableNoIndication { stopsOpened = !stopsOpened }.expandState(stopsOpened).padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Column(Modifier.width(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        repeat(3) { Box(Modifier.size(4.dp).background(color, CircleShape)) }
                    }
                    Text("${middle.size} ${plural(middle.size, "остановка", "остановки", "остановок")}", style = AppTheme.type.body, color = colors.functional)
                    TablerIcon(R.drawable.tabler_chevron_down, null, Modifier.size(18.dp).rotate(if (stopsOpened) 180f else 0f), tint = colors.functional)
                }
                if (stopsOpened) middle.forEach { RouteStop(it, color, big = false, onStopClick) }
            }
            if (stations.size > 1) RouteStop(stations.last(), color, big = true, onStopClick)
        }
    }
}

@Composable
private fun RouteStop(station: Station, color: androidx.compose.ui.graphics.Color, big: Boolean, onClick: (Station) -> Unit) {
    Row(Modifier.fillMaxWidth().clickableNoIndication { onClick(station) }.padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(Modifier.width(24.dp), contentAlignment = Alignment.Center) {
            Box(Modifier.size(if (big) 14.dp else 10.dp).background(AppTheme.colors.backgroundPrimary, CircleShape).border(if (big) 3.dp else 2.dp, color, CircleShape))
        }
        Text(station.name, style = AppTheme.type.caption, color = AppTheme.colors.textPrimary)
    }
}
