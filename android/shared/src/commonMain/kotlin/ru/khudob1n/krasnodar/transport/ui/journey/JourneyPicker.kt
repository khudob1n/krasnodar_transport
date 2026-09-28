package ru.khudob1n.krasnodar.transport.ui.journey

import ru.khudob1n.krasnodar.transport.ui.components.SvgIcon

import ru.khudob1n.krasnodar.transport.assets.Tabler

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import ru.khudob1n.krasnodar.transport.data.Catalog
import ru.khudob1n.krasnodar.transport.data.LatLngPoint
import ru.khudob1n.krasnodar.transport.data.Place
import ru.khudob1n.krasnodar.transport.domain.JourneyPoint
import ru.khudob1n.krasnodar.transport.domain.normalizeSearch
import ru.khudob1n.krasnodar.transport.domain.search
import ru.khudob1n.krasnodar.transport.map.stopKindOf
import ru.khudob1n.krasnodar.transport.ui.cards.StopKindIcon
import ru.khudob1n.krasnodar.transport.ui.components.TablerIcon
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme

/** Что выбрали для «откуда» или «куда». */
sealed interface JourneyPick {
    data class Point(val point: JourneyPoint) : JourneyPick
    data object MyLocation : JourneyPick
    data object OnMap : JourneyPick
}

private const val MAX_STOPS = 8

/**
 * Выбор точки маршрута (JourneyStopField сайта): остановка, вокзал, адрес или место на карте.
 * Пока ничего не введено - быстрые варианты «Моё местоположение» и «Указать на карте».
 * Адреса - из своего геокодера с паузой в наборе.
 */
@Composable
fun JourneyPicker(
    field: JourneyField,
    catalog: Catalog?,
    geocode: suspend (String) -> List<Place>,
    directionNote: (Long) -> String?,
    onPick: (JourneyPick) -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = AppTheme.colors
    val label = if (field == JourneyField.From) "Откуда" else "Куда"
    var query by remember { mutableStateOf("") }
    var places by remember { mutableStateOf<List<Place>?>(emptyList()) }
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { focus.requestFocus() }
    val normalized = normalizeSearch(query)
    val found = remember(catalog, normalized) { if (catalog == null || normalized.length < 2) null else search(catalog, normalized) }
    LaunchedEffect(normalized) {
        places = emptyList()
        if (normalized.length < 3) return@LaunchedEffect
        delay(350)
        places = runCatching { geocode(query.trim()) }.getOrNull()
    }

    Column(modifier.imePadding(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 48.dp).shadow(6.dp, AppTheme.shapes.search).background(colors.backgroundPrimary, AppTheme.shapes.search)
                .padding(start = 12.dp, end = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            JourneyMarker(if (field == JourneyField.From) "A" else "B")
            Box(Modifier.weight(1f)) {
                if (query.isEmpty()) Text("$label: остановка или адрес", style = AppTheme.type.body, color = colors.functional)
                BasicTextField(
                    query, { query = it }, Modifier.fillMaxWidth().focusRequester(focus),
                    singleLine = true,
                    textStyle = AppTheme.type.body.copy(color = colors.textPrimary),
                    cursorBrush = SolidColor(colors.textPrimary),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = {}),
                )
            }
            Box(Modifier.size(40.dp).clickable(role = Role.Button, onClickLabel = if (query.isEmpty()) "Закрыть" else "Очистить") { if (query.isEmpty()) onClose() else query = "" }, contentAlignment = Alignment.Center) {
                TablerIcon(Tabler.x, if (query.isEmpty()) "Закрыть" else "Очистить", tint = colors.functional)
            }
        }

        val rows = buildList<@Composable () -> Unit> {
            if (normalized.isEmpty()) {
                add { IconRow(Tabler.map_pin, "Моё местоположение", null) { onPick(JourneyPick.MyLocation) } }
                add { IconRow(Tabler.map_pin_search, "Указать на карте", "Нажмите на карту в нужном месте") { onPick(JourneyPick.OnMap) } }
            } else {
                found?.stops?.take(MAX_STOPS)?.forEach { stop ->
                    add {
                        ResultRow({ StopKindIcon(stopKindOf(catalog?.stopTypes?.get(stop.id)), 28.dp) }, stop.name, directionNote(stop.id)) {
                            onPick(JourneyPick.Point(JourneyPoint.StopPoint(stop.id, stop.name)))
                        }
                    }
                }
                found?.stations?.forEach { st ->
                    add { IconRow(Tabler.map_pin, st.name, null) { onPick(JourneyPick.Point(JourneyPoint.PlacePoint(LatLngPoint(st.lat, st.lng), st.name))) } }
                }
                places?.forEach { p ->
                    add { IconRow(Tabler.map_pin, p.title, p.subtitle.ifBlank { null }) { onPick(JourneyPick.Point(JourneyPoint.PlacePoint(LatLngPoint(p.lat, p.lng), p.title))) } }
                }
                if (places == null) add {
                    Text("Поиск адресов сейчас недоступен — выберите остановку или точку на карте.", Modifier.padding(16.dp), style = AppTheme.type.small, color = colors.functional)
                }
                if (size == 0 && normalized.length >= 2) add {
                    Text("Ничего не нашлось", Modifier.padding(16.dp), style = AppTheme.type.body, color = colors.functional)
                }
            }
        }
        LazyColumn(
            Modifier.fillMaxWidth().weight(1f, fill = false).shadow(6.dp, RoundedCornerShape(24.dp))
                .background(colors.backgroundPrimary, RoundedCornerShape(24.dp)).padding(vertical = 8.dp),
        ) { items(rows) { it() } }
    }
}

@Composable
private fun IconRow(icon: SvgIcon, title: String, subtitle: String?, onClick: () -> Unit) =
    ResultRow({ TablerIcon(icon, null, Modifier.size(24.dp), tint = AppTheme.colors.textSecondary) }, title, subtitle, onClick)

@Composable
private fun ResultRow(icon: @Composable () -> Unit, title: String, subtitle: String?, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(role = Role.Button, onClick = onClick).padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(Modifier.size(28.dp), contentAlignment = Alignment.Center) { icon() }
        Column(Modifier.weight(1f)) {
            Text(title, style = AppTheme.type.body.copy(fontWeight = FontWeight.Medium), color = AppTheme.colors.textPrimary)
            if (subtitle != null) Text(subtitle, style = AppTheme.type.small, color = AppTheme.colors.functional)
        }
    }
}
