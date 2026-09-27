package ru.khudob1n.krasnodar.transport.ui.cards

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import ru.khudob1n.krasnodar.transport.data.Catalog
import ru.khudob1n.krasnodar.transport.data.LatLngPoint
import ru.khudob1n.krasnodar.transport.data.ScheduleTrip
import ru.khudob1n.krasnodar.transport.data.Stop
import ru.khudob1n.krasnodar.transport.domain.Departure
import ru.khudob1n.krasnodar.transport.domain.StopBoard
import ru.khudob1n.krasnodar.transport.domain.formatArrival
import ru.khudob1n.krasnodar.transport.settings.LocalMapPreferences
import ru.khudob1n.krasnodar.transport.domain.stopBoard
import ru.khudob1n.krasnodar.transport.map.stopKindOf
import ru.khudob1n.krasnodar.transport.ui.components.RouteBadge
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme
import kotlin.math.cos
import kotlin.math.hypot

private const val NEARBY_COUNT = 5
private const val ARRIVALS_PER_STOP = 4

fun metresBetween(a: LatLngPoint, lat: Double, lng: Double): Double =
    hypot((a.lat - lat) * 111_320, (a.lng - lng) * 111_320 * cos(Math.toRadians(a.lat)))

private fun formatDistance(m: Double) =
    if (m < 1000) "${(Math.round(m / 10) * 10)} м" else "%.1f км".format(m / 1000).replace('.', ',')

/**
 * «Рядом со мной» (MapNearbySidebar сайта): 5 ближайших остановок с расстоянием, следующей
 * остановкой и до 4 ближайших рейсов. Отсчёт - от пользователя, а без геолокации - от центра карты.
 */
@Composable
fun NearbyCard(
    catalog: Catalog,
    origin: LatLngPoint?,
    fromMapCenter: Boolean,
    loadSchedule: suspend (Long) -> List<ScheduleTrip>,
    onStopClick: (Stop) -> Unit,
) {
    val colors = AppTheme.colors
    val nearest = remember(origin, catalog) {
        origin?.let { o -> catalog.stops.map { it to metresBetween(o, it.lat, it.lng) }.sortedBy { it.second }.take(NEARBY_COUNT) }.orEmpty()
    }
    val arrivals = remember { mutableStateMapOf<Long, List<Departure>>() }
    LaunchedEffect(nearest.map { it.first.id }) {
        for ((stop, _) in nearest) {
            val board = runCatching { stopBoard(loadSchedule(stop.id)) }.getOrNull()
            arrivals[stop.id] = (board as? StopBoard.Departures)?.items.orEmpty()
        }
    }

    Column(Modifier.verticalScroll(rememberScrollState())) {
        Column(Modifier.padding(start = 16.dp, end = 64.dp, top = 4.dp, bottom = 16.dp)) {
            Text("Рядом со мной", style = AppTheme.type.h4, color = colors.textPrimary)
            if (fromMapCenter) Text("Местоположение недоступно — показываем остановки у центра карты.", Modifier.padding(top = 6.dp), style = AppTheme.type.small, color = colors.textSecondary)
        }
        CardDivider()
        if (origin == null) Text("Определяем, где вы…", Modifier.padding(16.dp), style = AppTheme.type.body, color = colors.functional)
        nearest.forEach { (stop, distance) ->
            Row(
                Modifier.fillMaxWidth().clickableNoIndication { onStopClick(stop) }.padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                StopKindIcon(stopKindOf(catalog.stopTypes[stop.id]), 28.dp)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(stop.name, Modifier.weight(1f, fill = false), style = AppTheme.type.body.copy(fontWeight = FontWeight.SemiBold), color = colors.textPrimary)
                        Text(formatDistance(distance), style = AppTheme.type.small, color = colors.functional)
                    }
                    directionNote(catalog, stop.id)?.let { Text(it, style = AppTheme.type.small, color = colors.textSecondary) }
                    val items = arrivals[stop.id]
                    when {
                        items == null -> Text("Загружаем…", style = AppTheme.type.small, color = colors.functional)
                        items.isEmpty() -> Text("Ближайших рейсов нет", style = AppTheme.type.small, color = colors.functional)
                        else -> FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            items.take(ARRIVALS_PER_STOP).forEach { d ->
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    RouteBadge(d.route, d.type)
                                    Text(formatArrival(d.time, LocalMapPreferences.current.arrivalFormat), style = AppTheme.type.small, color = colors.textPrimary)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/** «→ следующая остановка» или «Конечная» (useStopDirections сайта). */
private fun directionNote(catalog: Catalog, stopId: Long): String? {
    var terminal = false
    for (route in catalog.routeStops) for (d in route.directions) {
        val i = d.stations.indexOfFirst { it.id == stopId }
        if (i >= 0 && i < d.stations.lastIndex) return "→ ${d.stations[i + 1].name}"
        if (i == d.stations.lastIndex && i >= 0) terminal = true
    }
    return if (terminal) "Конечная" else null
}
