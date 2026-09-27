package ru.khudob1n.krasnodar.transport.map

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.unit.dp
import ru.khudob1n.krasnodar.transport.R
import ru.khudob1n.krasnodar.transport.ui.components.MapButton
import ru.khudob1n.krasnodar.transport.ui.components.SiteIcon
import ru.khudob1n.krasnodar.transport.ui.components.TablerIcon
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme

/** Действия панели карты; пока не все экраны готовы - часть кнопок ничего не делает. */
class MapControlActions(
    val onSearch: () -> Unit = {},
    val onInfo: () -> Unit = {},
    val onNearby: () -> Unit = {},
    val onSettings: () -> Unit = {},
    val onToggleTheme: () -> Unit = {},
    val onJourney: () -> Unit = {},
    val onZoomIn: () -> Unit = {},
    val onZoomOut: () -> Unit = {},
    val onLocate: () -> Unit = {},
    val onFavorites: () -> Unit = {},
)

/**
 * Кнопки поверх карты: сверху поиск, пробки с погодой и кнопки инфо, «Рядом», настройки, тема
 * (на телефоне - сворачиваемым столбиком справа), справа внизу маршрут, масштаб и «где я», слева внизу избранное.
 */
@Composable
fun MapControls(
    actions: MapControlActions,
    searchHint: String,
    modifier: Modifier = Modifier,
    nearbyOpened: Boolean = false,
    settingsOpened: Boolean = false,
    infoOpened: Boolean = false,
    favoritesButton: Boolean = true,
    badges: @Composable (compact: Boolean) -> Unit = {},
) {
    val colors = AppTheme.colors
    // Шире 768 dp - ряд как на сайте: поиск, плашки пробок и погоды, четыре кнопки. На телефоне
    // сайт плашки прячет; приложение ставит в ряд одну компактную плашку и кнопку-шеврон, а четыре
    // кнопки - столбиком под ней, его можно свернуть, чтобы не закрывал карту.
    val wide = LocalConfiguration.current.screenWidthDp > 768
    var expanded by rememberSaveable { mutableStateOf(true) }
    Box(modifier.fillMaxSize().safeDrawingPadding().padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            SearchPill(searchHint, actions.onSearch, Modifier.weight(1f))
            badges(!wide)
            if (wide) {
                TopButtons(actions, nearbyOpened, settingsOpened, infoOpened)
            } else {
                val rotation by animateFloatAsState(if (expanded) 180f else 0f, label = "chevron")
                MapButton(
                    R.drawable.tabler_chevron_down,
                    if (expanded) "Скрыть кнопки" else "Показать кнопки",
                    { expanded = !expanded },
                    iconRotation = rotation,
                )
            }
        }
        if (!wide) {
            // Пока открыто «Рядом», столбик виден - иначе не видно, что режим включён.
            AnimatedVisibility(
                expanded || nearbyOpened || settingsOpened || infoOpened,
                Modifier.align(Alignment.TopEnd).padding(top = 60.dp),
                enter = expandVertically() + fadeIn(),
                exit = shrinkVertically() + fadeOut(),
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) { TopButtons(actions, nearbyOpened, settingsOpened, infoOpened) }
            }
        }

        Column(Modifier.align(Alignment.BottomEnd), verticalArrangement = Arrangement.spacedBy(12.dp), horizontalAlignment = Alignment.End) {
            MapButton(R.drawable.tabler_route, "Маршрут", actions.onJourney)
            ZoomGroup(actions.onZoomIn, actions.onZoomOut)
            MapButton(R.drawable.tabler_map_pin, "Показать моё местоположение", actions.onLocate)
        }

        // Открытая панель избранного встаёт на место звёздочки.
        if (favoritesButton) Box(
            Modifier
                .align(Alignment.BottomStart)
                .size(48.dp)
                .shadow(6.dp, AppTheme.shapes.mapButton)
                .background(colors.backgroundPrimary, AppTheme.shapes.mapButton)
                .clickable(role = Role.Button, onClick = actions.onFavorites),
            contentAlignment = Alignment.Center,
        ) {
            TablerIcon(R.drawable.tabler_star_filled, "Избранное", tint = colors.favorite)
        }
    }
}

@Composable
private fun TopButtons(actions: MapControlActions, nearbyOpened: Boolean, settingsOpened: Boolean, infoOpened: Boolean) {
    val dark = AppTheme.colors.isDark
    MapButton(R.drawable.tabler_info_circle, "Как пользоваться картой", actions.onInfo, opened = infoOpened)
    MapButton(R.drawable.tabler_map_pin_search, "Остановки рядом со мной", actions.onNearby, opened = nearbyOpened)
    MapButton(R.drawable.tabler_adjustments_horizontal, "Настройки", actions.onSettings, opened = settingsOpened)
    MapButton(
        if (dark) R.drawable.tabler_sun else R.drawable.tabler_moon,
        if (dark) "Включить светлую тему" else "Включить тёмную тему",
        actions.onToggleTheme,
    )
}

@Composable
private fun SearchPill(hint: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val colors = AppTheme.colors
    Row(
        modifier
            .heightIn(min = 48.dp)
            .shadow(6.dp, AppTheme.shapes.search)
            .background(colors.backgroundPrimary, AppTheme.shapes.search)
            .clickable(role = Role.Button, onClick = onClick)
            // Печатающийся пример меняется каждую секунду - TalkBack читает постоянную подпись.
            .clearAndSetSemantics { contentDescription = "Поиск остановок, маршрутов и вокзалов" }
            .padding(horizontal = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        SiteIcon("search", 22.dp, null, tint = colors.textPrimary)
        Text(hint, style = AppTheme.type.body, color = colors.functional, maxLines = 1)
    }
}

/** Масштаб - одна кнопка-столбик с «+» и «−», как zoom-control сайта. */
@Composable
private fun ZoomGroup(onZoomIn: () -> Unit, onZoomOut: () -> Unit) {
    val colors = AppTheme.colors
    Column(
        Modifier
            .width(48.dp)
            .shadow(6.dp, AppTheme.shapes.mapButton)
            .background(colors.backgroundPrimary, AppTheme.shapes.mapButton),
    ) {
        Box(Modifier.size(48.dp).clickable(role = Role.Button, onClick = onZoomIn), contentAlignment = Alignment.Center) {
            TablerIcon(R.drawable.tabler_plus, "Приблизить")
        }
        HorizontalDivider(Modifier.padding(horizontal = 12.dp), color = colors.backgroundSecondary)
        Box(Modifier.size(48.dp).clickable(role = Role.Button, onClick = onZoomOut), contentAlignment = Alignment.Center) {
            TablerIcon(R.drawable.tabler_minus, "Отдалить")
        }
    }
}
