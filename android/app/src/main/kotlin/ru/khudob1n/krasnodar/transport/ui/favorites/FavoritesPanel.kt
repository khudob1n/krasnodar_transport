package ru.khudob1n.krasnodar.transport.ui.favorites

import androidx.compose.foundation.background
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import ru.khudob1n.krasnodar.transport.R
import ru.khudob1n.krasnodar.transport.data.Catalog
import ru.khudob1n.krasnodar.transport.data.RouteStops
import ru.khudob1n.krasnodar.transport.data.ScheduleTrip
import ru.khudob1n.krasnodar.transport.data.Stop
import ru.khudob1n.krasnodar.transport.domain.Departure
import ru.khudob1n.krasnodar.transport.domain.StopBoard
import ru.khudob1n.krasnodar.transport.domain.formatArrival
import ru.khudob1n.krasnodar.transport.domain.stopBoard
import ru.khudob1n.krasnodar.transport.settings.Favorites
import ru.khudob1n.krasnodar.transport.settings.LocalFavorites
import ru.khudob1n.krasnodar.transport.settings.LocalMapPreferences
import ru.khudob1n.krasnodar.transport.ui.components.RouteBadge
import ru.khudob1n.krasnodar.transport.ui.components.TablerIcon
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme

private const val ARRIVALS_PER_STOP = 3
private const val REFRESH_MS = 60_000L

/**
 * Избранное на карте (MapFavoritesPanel сайта, мобильная вёрстка): открывается звёздочкой
 * слева внизу. Маршруты - номерами, остановки - с ближайшими рейсами и своими названиями.
 * Шириной до 320 и не шире экрана без колонки кнопок справа, высотой до 45 % экрана.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun FavoritesPanel(
    catalog: Catalog?,
    loadSchedule: suspend (Long) -> List<ScheduleTrip>,
    onClose: () -> Unit,
    onStopClick: (Stop) -> Unit,
    onRouteClick: (RouteStops) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = AppTheme.colors
    val favorites = LocalFavorites.current.value
    val config = LocalConfiguration.current
    val routes = favorites.routeIds.mapNotNull { catalog?.routeStopsById?.get(it) }
    val stops = favorites.stopIds.mapNotNull { id -> id.toLongOrNull()?.let { catalog?.stopsById?.get(it) } }
    val arrivals = remember { mutableStateMapOf<Long, List<Departure>>() }
    var tick by remember { mutableStateOf(0) }
    // Раз в минуту - свежие рейсы и пересчёт «через N мин».
    LaunchedEffect(stops.map { it.id }) {
        while (true) {
            for (stop in stops) {
                val board = runCatching { stopBoard(loadSchedule(stop.id)) }.getOrNull()
                arrivals[stop.id] = (board as? StopBoard.Departures)?.items.orEmpty()
            }
            delay(REFRESH_MS)
            tick++
        }
    }

    Column(
        modifier
            .width(minOf(320, config.screenWidthDp - 88).dp)
            .heightIn(max = minOf(420f, config.screenHeightDp * 0.45f).dp)
            .shadow(12.dp, AppTheme.shapes.mapButton)
            .background(colors.backgroundPrimary, AppTheme.shapes.mapButton),
    ) {
        Row(
            Modifier.fillMaxWidth().clickable(role = Role.Button, onClickLabel = "Свернуть избранное", onClick = onClose).padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            TablerIcon(R.drawable.tabler_star_filled, null, Modifier.size(16.dp), tint = colors.tram)
            Text("Избранное", Modifier.weight(1f), style = AppTheme.type.small.copy(fontWeight = FontWeight.SemiBold, lineHeight = 16.sp), color = colors.textSecondary)
            TablerIcon(R.drawable.tabler_chevron_down, null, Modifier.size(18.dp), tint = colors.functional)
        }
        Column(Modifier.verticalScroll(rememberScrollState()).padding(start = 6.dp, end = 6.dp, bottom = 6.dp)) {
            if (favorites.isEmpty) {
                Text(
                    "Откройте остановку или маршрут и нажмите «В избранное» — они появятся здесь.",
                    Modifier.padding(start = 8.dp, end = 8.dp, bottom = 8.dp),
                    style = AppTheme.type.small.copy(lineHeight = 18.sp),
                    color = colors.functional,
                )
            }
            if (routes.isNotEmpty()) {
                FlowRow(Modifier.padding(start = 8.dp, end = 8.dp, bottom = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    routes.forEach { route ->
                        val type = route.transport ?: return@forEach
                        RouteBadge(
                            route.number, type,
                            Modifier.minimumInteractiveComponentSize().clickable(role = Role.Button, onClick = { onRouteClick(route) })
                                .semantics { contentDescription = "Маршрут ${route.number}: ${route.fromStation} – ${route.toStation}" },
                            small = true,
                        )
                    }
                }
            }
            stops.forEach { stop ->
                StopRow(stop, favorites, tick.let { arrivals[stop.id] }, onClick = { onStopClick(stop) })
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun StopRow(stop: Stop, favorites: Favorites, arrivals: List<Departure>?, onClick: () -> Unit) {
    val colors = AppTheme.colors
    val update = LocalFavorites.current.update
    val format = LocalMapPreferences.current.arrivalFormat
    val custom = favorites.stopNames[stop.id.toString()]
    var editing by remember(stop.id) { mutableStateOf(false) }

    if (editing) {
        var value by remember { mutableStateOf(custom.orEmpty()) }
        val focus = remember { FocusRequester() }
        LaunchedEffect(Unit) { focus.requestFocus() }
        fun save() { update { it.rename(stop.id, value) }; editing = false }
        Row(Modifier.fillMaxWidth().padding(start = 8.dp, end = 4.dp, top = 6.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            Box(
                Modifier.weight(1f).height(34.dp).border(1.dp, colors.backgroundSecondary, RoundedCornerShape(10.dp)).padding(horizontal = 10.dp),
                contentAlignment = Alignment.CenterStart,
            ) {
                if (value.isEmpty()) Text(stop.name, style = AppTheme.type.body.copy(fontSize = 15.sp), color = colors.functional, maxLines = 1, overflow = TextOverflow.Ellipsis)
                BasicTextField(
                    value, { value = it.take(Favorites.STOP_NAME_MAX_LENGTH) },
                    Modifier.fillMaxWidth().focusRequester(focus).semantics { contentDescription = "Своё название для остановки «${stop.name}»" },
                    singleLine = true,
                    textStyle = AppTheme.type.body.copy(fontSize = 15.sp, color = colors.textPrimary),
                    cursorBrush = SolidColor(colors.textPrimary),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { save() }),
                )
            }
            IconButton(R.drawable.tabler_check, "Сохранить название") { save() }
            IconButton(R.drawable.tabler_x, "Отменить") { editing = false }
        }
        return
    }

    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        Column(
            Modifier.weight(1f).clickable(role = Role.Button, onClick = onClick).padding(8.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Column {
                Text(custom ?: stop.name, style = AppTheme.type.body.copy(fontSize = 15.sp, fontWeight = FontWeight.Medium, lineHeight = 20.sp), color = colors.textPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (custom != null) Text(stop.name, style = AppTheme.type.small.copy(fontSize = 12.sp, lineHeight = 16.sp), color = colors.functional, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            when {
                arrivals == null -> Text("Загружаем…", style = AppTheme.type.small, color = colors.functional)
                arrivals.isEmpty() -> Text("Ближайших рейсов нет", style = AppTheme.type.small, color = colors.functional)
                else -> FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    arrivals.take(ARRIVALS_PER_STOP).forEach { d ->
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            RouteBadge(d.route, d.type, small = true)
                            Text(formatArrival(d.time, format), style = AppTheme.type.body.copy(fontSize = 14.sp), color = colors.textPrimary)
                        }
                    }
                }
            }
        }
        Box(Modifier.padding(top = 4.dp)) {
            IconButton(R.drawable.tabler_pencil, "Переименовать остановку «${custom ?: stop.name}»", iconSize = 16) { editing = true }
        }
    }
}

@Composable
private fun IconButton(icon: Int, description: String, iconSize: Int = 18, onClick: () -> Unit) {
    Box(
        Modifier.minimumInteractiveComponentSize().size(32.dp).clickable(role = Role.Button, onClickLabel = description, onClick = onClick).semantics { contentDescription = description },
        contentAlignment = Alignment.Center,
    ) {
        TablerIcon(icon, null, Modifier.size(iconSize.dp), tint = AppTheme.colors.functional)
    }
}
