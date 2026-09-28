package ru.khudob1n.krasnodar.transport.ui.settings

import ru.khudob1n.krasnodar.transport.assets.Tabler

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.toggleable
import ru.khudob1n.krasnodar.transport.platform.AppConfig
import ru.khudob1n.krasnodar.transport.data.Catalog
import ru.khudob1n.krasnodar.transport.domain.ArrivalFormat
import ru.khudob1n.krasnodar.transport.settings.Basemap
import ru.khudob1n.krasnodar.transport.settings.IconSizes
import ru.khudob1n.krasnodar.transport.settings.MapPreferences
import ru.khudob1n.krasnodar.transport.settings.StartView
import ru.khudob1n.krasnodar.transport.settings.StopDefaultView
import ru.khudob1n.krasnodar.transport.ui.cards.CardDivider
import ru.khudob1n.krasnodar.transport.ui.components.PillButton
import ru.khudob1n.krasnodar.transport.ui.components.PillGrid
import ru.khudob1n.krasnodar.transport.ui.components.TablerIcon
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme
import ru.khudob1n.krasnodar.transport.ui.theme.ThemePreference
import kotlin.math.roundToInt

/**
 * Настройки (components/Map/Settings/MapSettingsSidebar сайта): тема, что показывать, размеры
 * меток, карта, остановки, маршрут, сброс. Мини-карта прилипает к верху, пока листаешь слои и
 * размеры, - изменения видно сразу. Всё применяется без кнопки «Сохранить».
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun SettingsCard(
    theme: ThemePreference,
    onThemeChange: (ThemePreference) -> Unit,
    preferences: MapPreferences,
    onChange: ((MapPreferences) -> MapPreferences) -> Unit,
    catalog: Catalog?,
    onResetAll: () -> Unit,
    favoritesTransfer: @Composable () -> Unit = {},
    onOpenArticle: (String) -> Unit = {},
) {
    val p = preferences
    LazyColumn(Modifier.fillMaxWidth()) {
        item {
            Text(
                "Настройки",
                Modifier.padding(start = 22.dp, end = 80.dp, top = 4.dp, bottom = 18.dp),
                style = AppTheme.type.h4.copy(fontWeight = FontWeight.Bold),
                color = AppTheme.colors.textPrimary,
            )
            CardDivider()
            Section("Тема") { ThemeChooser(theme, onThemeChange) }
            CardDivider()
        }
        stickyHeader {
            Box(Modifier.background(AppTheme.colors.backgroundPrimary).padding(horizontal = 22.dp, vertical = 12.dp)) {
                MapPreview(p, catalog)
            }
        }
        item {
            Section("Что показывать на карте") {
                val l = p.layers
                SettingSwitch("Автобусы", checked = l.bus, color = AppTheme.colors.bus) { v -> onChange { it.copy(layers = it.layers.copy(bus = v)) } }
                SettingSwitch("Троллейбусы", checked = l.troll, color = AppTheme.colors.troll) { v -> onChange { it.copy(layers = it.layers.copy(troll = v)) } }
                SettingSwitch("Трамваи", checked = l.tram, color = AppTheme.colors.tram) { v -> onChange { it.copy(layers = it.layers.copy(tram = v)) } }
                SettingSwitch("Остановки", "Остановки скрытых видов транспорта не показываются", l.stops) { v -> onChange { it.copy(layers = it.layers.copy(stops = v)) } }
                SettingSwitch("Вокзалы и аэропорт", "Ж/д станции, автовокзалы, аэропорт", l.rail) { v -> onChange { it.copy(layers = it.layers.copy(rail = v)) } }
                SettingSwitch("Депо и автобусные парки", checked = l.depots) { v -> onChange { it.copy(layers = it.layers.copy(depots = v)) } }
                Column(
                    Modifier.fillMaxWidth().padding(top = 2.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    CardDivider()
                    SettingSwitch("Только низкопольный транспорт", "Машины, в которые удобно заехать с коляской", p.lowFloorOnly) { v -> onChange { it.copy(lowFloorOnly = v) } }
                    SettingSwitch("Машины без свежих координат", "Больше 5 минут не присылали, где они, — показаны штриховкой", p.showStale) { v -> onChange { it.copy(showStale = v) } }
                    SettingSwitch("Подписи на карте", "Названия остановок, станций, вокзалов и депо", p.labels) { v -> onChange { it.copy(labels = v) } }
                }
            }
            CardDivider()
            Section("Размер меток на карте") {
                val s = p.iconSizes
                fun set(f: (IconSizes) -> IconSizes) = onChange { it.copy(iconSizes = f(it.iconSizes)) }
                SizeSlider("Все метки", "Общий масштаб, умножается на настройки ниже", s.all, main = true) { v -> set { it.copy(all = v) } }
                SizeSlider("Транспорт на карте", "Автобусы, троллейбусы и трамваи", s.vehicles) { v -> set { it.copy(vehicles = v) } }
                SizeSlider("Остановки", null, s.stops) { v -> set { it.copy(stops = v) } }
                SizeSlider("Железнодорожные станции", "Вокзалы и платформы", s.rail) { v -> set { it.copy(rail = v) } }
                SizeSlider("Аэропорт", null, s.airport) { v -> set { it.copy(airport = v) } }
                SizeSlider("Прочие объекты", "Автовокзалы", s.other) { v -> set { it.copy(other = v) } }
                PillGrid { button { PillButton("Сбросить", { set { IconSizes() } }, icon = Tabler.restore, enabled = !s.isDefault) } }
            }
        }
        // Пустой «заголовок» выталкивает мини-карту: она прилипает только над слоями и размерами,
        // ниже, где она уже не нужна, уезжает вместе со списком.
        stickyHeader { Spacer(Modifier.height(0.dp)) }
        item {
            CardDivider()
            Section("Карта") {
                Choice(
                    "Подложка", "Упрощённая — без зданий и номеров домов, транспорт на ней заметнее",
                    listOf(Basemap.Default to "Обычная", Basemap.Simple to "Упрощённая"), p.basemap,
                ) { v -> onChange { it.copy(basemap = v) } }
                Choice(
                    "Где открывать карту", null,
                    listOf(StartView.Center to "Центр города", StartView.Location to "Где я", StartView.Last to "Последнее место"), p.startView,
                ) { v -> onChange { it.copy(startView = v) } }
                SettingSwitch(
                    "Уменьшить движение", "Без анимаций и пульсации; машины переставляются раз в 30 секунд, а не едут плавно", p.reduceMotion,
                ) { v -> onChange { it.copy(reduceMotion = v) } }
            }
            CardDivider()
            Section("Остановки") {
                Choice(
                    "Время прибытия", null,
                    listOf(ArrivalFormat.Relative to "Через 5 мин", ArrivalFormat.Absolute to "В 14:32"), p.arrivalFormat,
                ) { v -> onChange { it.copy(arrivalFormat = v) } }
                Choice(
                    "Карточка остановки открывается", null,
                    listOf(StopDefaultView.Arrivals to "С ближайшими", StopDefaultView.Schedule to "С расписанием"), p.stopDefaultView,
                ) { v -> onChange { it.copy(stopDefaultView = v) } }
            }
            Section("Маршрут") {
                Choice(
                    "Пересадок не больше", "Больше пересадок — больше вариантов, но они длиннее и сложнее",
                    listOf(0 to "Без", 1 to "1", 2 to "2", 3 to "3"), p.maxTransfers,
                ) { v -> onChange { it.copy(maxTransfers = v) } }
            }
            CardDivider()
            favoritesTransfer()
            CardDivider()
            ResetAll(onResetAll)
            CardDivider()
            // Справка и версия внизу (About сайта); «О проекте» и «Откуда данные» на сайте - на главной.
            PillGrid(Modifier.padding(start = 22.dp, end = 22.dp, top = 18.dp)) {
                button { PillButton("О проекте", { onOpenArticle("o-proekte") }, icon = Tabler.info_circle) }
                button { PillButton("Откуда данные", { onOpenArticle("istochniki-dannyh") }, icon = Tabler.book) }
                button { PillButton("Как пользоваться картой", { onOpenArticle("kak-chitat-kartu") }, icon = Tabler.book) }
            }
            Text(
                "Версия ${AppConfig.versionName}",
                Modifier.padding(horizontal = 22.dp, vertical = 18.dp),
                style = AppTheme.type.small.copy(lineHeight = 18.sp),
                color = AppTheme.colors.functional,
            )
        }
    }
}

@Composable
internal fun Section(title: String, content: @Composable () -> Unit) {
    Column(
        Modifier.fillMaxWidth().padding(start = 22.dp, end = 22.dp, top = 18.dp, bottom = 16.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        Text(title, style = AppTheme.type.small.copy(fontWeight = FontWeight.SemiBold, lineHeight = 16.sp), color = AppTheme.colors.textSecondary)
        content()
    }
}

@Composable
private fun Label(label: String, hint: String?, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, style = AppTheme.type.button, color = AppTheme.colors.textPrimary)
        if (hint != null) Text(hint, style = AppTheme.type.small.copy(fontSize = 12.sp, lineHeight = 16.sp), color = AppTheme.colors.functional)
    }
}

/** Строка с переключателем 40x24; color - цвет включённой дорожки (вид транспорта). */
@Composable
private fun SettingSwitch(label: String, hint: String? = null, checked: Boolean, color: Color? = null, onChange: (Boolean) -> Unit) {
    val colors = AppTheme.colors
    val track by animateColorAsState(if (checked) color ?: colors.textPrimary else colors.backgroundSecondary, label = "track")
    val knob by animateDpAsState(if (checked) 16.dp else 0.dp, label = "knob")
    Row(
        Modifier.fillMaxWidth().toggleable(checked, role = Role.Switch, onValueChange = onChange),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Label(label, hint, Modifier.weight(1f))
        Box(
            Modifier.size(40.dp, 24.dp).background(track, RoundedCornerShape(12.dp))
                .border(1.dp, if (checked) Color.Transparent else colors.functionalTram.copy(alpha = 0.5f), RoundedCornerShape(12.dp)),
        ) {
            Box(Modifier.padding(3.dp).offset(x = knob).size(18.dp).shadow(1.dp, CircleShape).background(colors.backgroundPrimary, CircleShape))
        }
    }
}

/** Тема: три равные кнопки с иконками одной полосой, выбранная - контрастная. */
@Composable
private fun ThemeChooser(theme: ThemePreference, onChange: (ThemePreference) -> Unit) {
    Segments(
        listOf(
            Triple(ThemePreference.Light, "Светлая", Tabler.sun),
            Triple(ThemePreference.Dark, "Тёмная", Tabler.moon),
            Triple(ThemePreference.System, "Как в системе", Tabler.device_desktop),
        ),
        theme, onChange,
    )
}

@Composable
private fun <T> Choice(title: String, hint: String?, options: List<Pair<T, String>>, selected: T, onChange: (T) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Label(title, hint)
        Segments(options.map { Triple(it.first, it.second, null) }, selected, onChange)
    }
}

@Composable
private fun <T> Segments(options: List<Triple<T, String, ru.khudob1n.krasnodar.transport.ui.components.SvgIcon?>>, selected: T, onChange: (T) -> Unit) {
    val colors = AppTheme.colors
    Row(
        Modifier.fillMaxWidth().background(colors.backgroundSecondary, RoundedCornerShape(14.dp)).padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        options.forEach { (value, label, icon) ->
            val active = value == selected
            Column(
                Modifier.weight(1f).heightIn(min = if (icon != null) 56.dp else 36.dp)
                    .then(if (active) Modifier.shadow(2.dp, RoundedCornerShape(10.dp)) else Modifier)
                    .background(if (active) colors.backgroundPrimary else Color.Transparent, RoundedCornerShape(10.dp))
                    .selectable(active, role = Role.RadioButton) { onChange(value) }
                    .padding(horizontal = 4.dp, vertical = 6.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterVertically),
            ) {
                val tint = if (active) colors.textPrimary else colors.textSecondary
                if (icon != null) TablerIcon(icon, null, Modifier.size(20.dp), tint = tint)
                Text(label, style = AppTheme.type.small.copy(fontWeight = FontWeight.Medium, lineHeight = 16.sp), color = tint, maxLines = 1)
            }
        }
    }
}

/** Ползунок размера: 60-160 % с шагом 10 %, справа - значение. */
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
private fun SizeSlider(label: String, hint: String?, value: Float, main: Boolean = false, onChange: (Float) -> Unit) {
    val percent = "${(value * 100).roundToInt()}%"
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.Top) {
            Label(label, hint, Modifier.weight(1f))
            Text(percent, style = AppTheme.type.body.copy(fontSize = 14.sp), color = AppTheme.colors.textSecondary)
        }
        // Как range сайта: тонкая дорожка и круглый бегунок цвета текста.
        Slider(
            value = value,
            onValueChange = { onChange(IconSizes.clamp(it)) },
            valueRange = IconSizes.MIN..IconSizes.MAX,
            steps = 9,
            modifier = Modifier.fillMaxWidth().height(28.dp).semantics { contentDescription = label; stateDescription = percent },
            thumb = { Box(Modifier.size(20.dp).shadow(1.dp, CircleShape).background(AppTheme.colors.textPrimary, CircleShape)) },
            track = {
                val fraction = (value - IconSizes.MIN) / (IconSizes.MAX - IconSizes.MIN)
                Box(Modifier.fillMaxWidth().height(4.dp).background(AppTheme.colors.backgroundSecondary, CircleShape)) {
                    Box(Modifier.fillMaxWidth(fraction).height(4.dp).background(AppTheme.colors.textPrimary, CircleShape))
                }
            },
        )
        if (main) CardDivider()
    }
}

/** «Сбросить всё» - в два нажатия, чтобы не стереть всё случайно (ResetAll сайта). */
@Composable
private fun ResetAll(onReset: () -> Unit) {
    var confirming by remember { mutableStateOf(false) }
    Section("Данные") {
        Text(
            "Удалит избранное, все настройки, тему и историю поиска.",
            style = AppTheme.type.small.copy(lineHeight = 18.sp),
            color = AppTheme.colors.functional,
        )
        PillGrid {
            if (confirming) {
                button { PillButton("Да, сбросить всё", { confirming = false; onReset() }, icon = Tabler.trash, danger = true) }
                button { PillButton("Отмена", { confirming = false }, icon = Tabler.x) }
            } else {
                button { PillButton("Сбросить всё", { confirming = true }, icon = Tabler.trash) }
            }
        }
    }
}
