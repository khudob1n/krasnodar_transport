package ru.khudob1n.krasnodar.transport.ui.search

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import ru.khudob1n.krasnodar.transport.R
import ru.khudob1n.krasnodar.transport.data.Catalog
import ru.khudob1n.krasnodar.transport.data.Depot
import ru.khudob1n.krasnodar.transport.data.RailStation
import ru.khudob1n.krasnodar.transport.data.RouteStops
import ru.khudob1n.krasnodar.transport.data.Stop
import ru.khudob1n.krasnodar.transport.domain.normalizeSearch
import ru.khudob1n.krasnodar.transport.domain.plural
import ru.khudob1n.krasnodar.transport.domain.search
import ru.khudob1n.krasnodar.transport.map.MarkerRenderer
import ru.khudob1n.krasnodar.transport.map.stopKindOf
import ru.khudob1n.krasnodar.transport.settings.SearchHistoryEntry
import ru.khudob1n.krasnodar.transport.ui.cards.StopKindIcon
import ru.khudob1n.krasnodar.transport.ui.cards.TransportTypeIcon
import ru.khudob1n.krasnodar.transport.ui.cards.clickableNoIndication
import ru.khudob1n.krasnodar.transport.ui.components.RouteBadge
import ru.khudob1n.krasnodar.transport.ui.components.SiteIcon
import ru.khudob1n.krasnodar.transport.ui.components.TablerIcon
import ru.khudob1n.krasnodar.transport.ui.components.TransportType
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme

/** Что выбрали в поиске. */
sealed interface SearchPick {
    data class StopPick(val stop: Stop) : SearchPick
    data class RoutePick(val route: RouteStops) : SearchPick
    data class StationPick(val station: RailStation) : SearchPick
    data class DepotPick(val depot: Depot) : SearchPick
}

/** Больше остановок не рисуем (на одну букву их сотни); счётчик в заголовке - полный. */
private const val MAX_STOPS_SHOWN = 30

private val ROUTE_GROUPS = listOf(TransportType.Tram to "Трамваи", TransportType.Troll to "Троллейбусы", TransportType.Bus to "Автобусы")

/**
 * Поиск (components/Map/SearchBar сайта): поле на месте строки поиска, под ним выдача группами -
 * остановки, маршруты по видам, вокзалы и аэропорт, депо; в пустом поле - недавние.
 */
@Composable
fun SearchScreen(
    catalog: Catalog?,
    history: List<SearchHistoryEntry>,
    onPick: (SearchPick) -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = AppTheme.colors
    var query by remember { mutableStateOf("") }
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { focus.requestFocus() }
    val normalized = normalizeSearch(query)
    val results = remember(catalog, normalized) { if (catalog == null || normalized.isEmpty()) null else search(catalog, normalized) }

    // Выдача - над клавиатурой: список сжимается, а не уходит под неё.
    Column(modifier.imePadding(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 48.dp)
                .shadow(6.dp, AppTheme.shapes.search)
                .background(colors.backgroundPrimary, AppTheme.shapes.search)
                .padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            SiteIcon("search", 22.dp, null, tint = colors.textPrimary)
            Box(Modifier.weight(1f)) {
                if (query.isEmpty()) Text("Остановка, маршрут, вокзал", style = AppTheme.type.body, color = colors.functional)
                BasicTextField(
                    query, { query = it },
                    Modifier.fillMaxWidth().focusRequester(focus),
                    singleLine = true,
                    textStyle = AppTheme.type.body.copy(color = colors.textPrimary),
                    cursorBrush = SolidColor(colors.textPrimary),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = {}),
                )
            }
            Box(Modifier.clickableNoIndication { if (query.isEmpty()) onClose() else query = "" }) {
                TablerIcon(R.drawable.tabler_x, if (query.isEmpty()) "Закрыть поиск" else "Очистить", tint = colors.functional)
            }
        }

        val sections = buildList<@Composable () -> Unit> {
            if (results == null) {
                val items = history.mapNotNull { e -> resolve(catalog, e) }
                if (items.isNotEmpty()) add { Group("Недавние", null) { items.forEach { ResultRow(catalog, it, onPick) } } }
            } else if (results.isEmpty) {
                add { Text("Ничего не нашлось", Modifier.padding(16.dp), style = AppTheme.type.body, color = colors.functional) }
            } else {
                if (results.stops.isNotEmpty()) add {
                    Group("Остановки", results.stops.size) { results.stops.take(MAX_STOPS_SHOWN).forEach { ResultRow(catalog, SearchPick.StopPick(it), onPick) } }
                }
                for ((type, title) in ROUTE_GROUPS) {
                    val routes = results.routes.filter { it.transport == type }
                    if (routes.isNotEmpty()) add { Group(title, routes.size) { routes.forEach { ResultRow(catalog, SearchPick.RoutePick(it), onPick) } } }
                }
                if (results.stations.isNotEmpty()) add {
                    Group("Вокзалы и аэропорт", results.stations.size) { results.stations.forEach { ResultRow(catalog, SearchPick.StationPick(it), onPick) } }
                }
                if (results.depots.isNotEmpty()) add {
                    Group("Депо", results.depots.size) { results.depots.forEach { ResultRow(catalog, SearchPick.DepotPick(it), onPick) } }
                }
            }
        }
        if (sections.isNotEmpty()) {
            LazyColumn(
                Modifier.fillMaxWidth().weight(1f, fill = false)
                    .shadow(6.dp, RoundedCornerShape(24.dp))
                    .background(colors.backgroundPrimary, RoundedCornerShape(24.dp))
                    .padding(vertical = 8.dp),
            ) {
                items(sections) { it() }
            }
        }
    }
}

private fun resolve(catalog: Catalog?, e: SearchHistoryEntry): SearchPick? {
    catalog ?: return null
    return when (e.kind) {
        "stop" -> e.id.toLongOrNull()?.let(catalog.stopsById::get)?.let(SearchPick::StopPick)
        "route" -> e.id.toLongOrNull()?.let(catalog.routeStopsById::get)?.let(SearchPick::RoutePick)
        "rail" -> catalog.railStations.firstOrNull { it.id == e.id }?.let(SearchPick::StationPick)
        "depot" -> catalog.depots.firstOrNull { it.id == e.id }?.let(SearchPick::DepotPick)
        else -> null
    }
}

fun SearchPick.historyEntry(): SearchHistoryEntry = when (this) {
    is SearchPick.StopPick -> SearchHistoryEntry("stop", stop.id.toString())
    is SearchPick.RoutePick -> SearchHistoryEntry("route", route.id.toString())
    is SearchPick.StationPick -> SearchHistoryEntry("rail", station.id)
    is SearchPick.DepotPick -> SearchHistoryEntry("depot", depot.id)
}

@Composable
private fun Group(title: String, count: Int?, content: @Composable () -> Unit) {
    Column(Modifier.padding(vertical = 6.dp)) {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(title, style = AppTheme.type.small.copy(fontWeight = FontWeight.SemiBold), color = AppTheme.colors.textSecondary)
            if (count != null) Text(count.toString(), style = AppTheme.type.small, color = AppTheme.colors.functional)
        }
        content()
    }
}

@Composable
private fun ResultRow(catalog: Catalog?, pick: SearchPick, onPick: (SearchPick) -> Unit) {
    val colors = AppTheme.colors
    Row(
        Modifier.fillMaxWidth().clickableNoIndication { onPick(pick) }.padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        when (pick) {
            is SearchPick.StopPick -> {
                StopKindIcon(stopKindOf(catalog?.stopTypes?.get(pick.stop.id)), 22.dp)
                Column {
                    Text(pick.stop.name, style = AppTheme.type.body, color = colors.textPrimary)
                    // Следующая остановка - так различаются одноимённые остановки по разные стороны улицы.
                    nextStopName(catalog, pick.stop.id)?.let { Text("→ $it", style = AppTheme.type.small, color = colors.functional) }
                }
            }
            is SearchPick.RoutePick -> {
                val type = pick.route.transport ?: TransportType.Bus
                RouteBadge(pick.route.number, type)
                val extra = pick.route.directions.size - 1
                Text(
                    "${pick.route.fromStation} – ${pick.route.toStation}" + if (extra > 0) " (и ещё $extra ${plural(extra, "подмаршрут", "подмаршрута", "подмаршрутов")})" else "",
                    style = AppTheme.type.body, color = colors.textPrimary,
                )
            }
            is SearchPick.StationPick -> {
                val context = LocalContext.current
                val px = with(LocalDensity.current) { 22.dp.roundToPx() }
                val dark = colors.isDark
                val icon = remember(pick.station.kind, dark) { MarkerRenderer(context).stationIcon(pick.station.kind, px, dark).asImageBitmap() }
                Image(icon, null, Modifier.size(22.dp))
                Text(pick.station.name, style = AppTheme.type.body, color = colors.textPrimary)
            }
            is SearchPick.DepotPick -> {
                TransportTypeIcon(when (pick.depot.type) { "tram" -> TransportType.Tram; "troll" -> TransportType.Troll; else -> TransportType.Bus }, 20.dp)
                Text(pick.depot.name, style = AppTheme.type.body, color = colors.textPrimary)
            }
        }
    }
}

/** Следующая остановка после этой по первому попавшемуся направлению - «в какую сторону». */
fun nextStopName(catalog: Catalog?, stopId: Long): String? {
    catalog ?: return null
    for (route in catalog.routeStops) for (d in route.directions) {
        val i = d.stations.indexOfFirst { it.id == stopId }
        if (i >= 0 && i < d.stations.lastIndex) return d.stations[i + 1].name
    }
    return null
}
