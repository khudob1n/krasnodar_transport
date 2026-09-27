package ru.khudob1n.krasnodar.transport.ui.info

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.khudob1n.krasnodar.transport.R
import ru.khudob1n.krasnodar.transport.map.MarkerRenderer
import ru.khudob1n.krasnodar.transport.map.StopKind
import ru.khudob1n.krasnodar.transport.ui.components.SiteIcon
import ru.khudob1n.krasnodar.transport.ui.components.TablerIcon
import ru.khudob1n.krasnodar.transport.ui.components.TransportType
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme

// Образцы обозначений рисует тот же MarkerRenderer, что и карту, - значки здесь всегда
// совпадают с картой (так же легенда сайта собрана из настоящих маркеров).

@Composable
private fun rendered(key: Any, draw: (MarkerRenderer, Boolean) -> android.graphics.Bitmap): androidx.compose.ui.graphics.ImageBitmap {
    val context = LocalContext.current
    val dark = AppTheme.colors.isDark
    return remember(key, dark) { draw(MarkerRenderer(context), dark).asImageBitmap() }
}

/** Картинка маркера в её собственном размере (пиксели -> dp). */
@Composable
private fun MarkerImage(bitmap: androidx.compose.ui.graphics.ImageBitmap, modifier: Modifier = Modifier) {
    val density = LocalDensity.current
    Image(bitmap, null, modifier.requiredSize(with(density) { bitmap.width.toDp() }, with(density) { bitmap.height.toDp() }))
}

/** Кружок остановки или вокзала крупнее, чем на карте, - 32, как образцы на сайте. */
@Composable
fun StopSample(kind: StopKind) = Image(rendered(kind) { r, dark -> r.stop(kind, dark) }, null, Modifier.size(32.dp))

@Composable
fun StationSample(kind: String) = Image(rendered(kind) { r, dark -> r.station(kind, dark) }, null, Modifier.size(32.dp))

/** Машина: капля курсом 45° и бейджи справа, в коробке 120x48, как в легенде сайта. */
@Composable
fun VehicleSample(type: TransportType, number: String, lowFloor: Boolean = false, warning: Boolean = false) {
    val arrow = rendered(type) { r, dark -> r.arrow(type, stale = false, dark = dark) }
    val body = rendered(listOf(type, number, lowFloor, warning)) { r, dark -> r.body(type, number, east = false, lowFloor = lowFloor, warning = warning, stale = false, dark = dark) }
    // Центр капли - в центре обеих картинок; ставим его в точку (24, 24) коробки. Рисуем на
    // Canvas: бейджи шире коробки, и обычная раскладка центрировала бы их, сдвинув с капли.
    Canvas(Modifier.size(120.dp, 48.dp)) {
        val center = androidx.compose.ui.geometry.Offset(24.dp.toPx(), 24.dp.toPx())
        rotate(45f, pivot = center) {
            drawImage(arrow, androidx.compose.ui.geometry.Offset(center.x - arrow.width / 2f, center.y - arrow.height / 2f))
        }
        drawImage(body, androidx.compose.ui.geometry.Offset(center.x - body.width / 2f, center.y - body.height / 2f))
    }
}

/** Депо - как полигон на карте: лёгкая заливка и обводка цветом вида транспорта. */
@Composable
fun AreaSample(color: Color) {
    Box(Modifier.size(20.dp, 16.dp).background(color.copy(alpha = 0.14f), RoundedCornerShape(3.dp)).border(2.dp, color, RoundedCornerShape(3.dp)))
}

@Composable
fun Swatch(color: Color) = Box(Modifier.size(24.dp).background(color, CircleShape))

/** Бейдж-признак машины (низкий пол, не по маршруту) - той же высоты, что кружки остановок. */
@Composable
fun FeatureSample(content: @Composable () -> Unit) {
    Box(
        Modifier.size(32.dp).shadow(1.dp, RoundedCornerShape(10.dp)).background(AppTheme.colors.backgroundPrimary, RoundedCornerShape(10.dp))
            .border(1.dp, Color(0xFFE6E4E0).copy(alpha = if (AppTheme.colors.isDark) 0.2f else 1f), RoundedCornerShape(10.dp)),
        contentAlignment = Alignment.Center,
    ) { content() }
}

@Composable
private fun LegendRow(title: String, hint: String? = null, sampleWidth: Dp = 120.dp, sample: @Composable () -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        Box(Modifier.width(sampleWidth).heightIn(min = 32.dp).clearAndSetSemantics {}, contentAlignment = Alignment.Center) { sample() }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, style = AppTheme.type.body.copy(fontWeight = FontWeight.Medium, lineHeight = 22.sp), color = AppTheme.colors.textPrimary)
            if (hint != null) Text(hint, style = AppTheme.type.body.copy(fontSize = 14.sp, lineHeight = 20.sp), color = AppTheme.colors.functional)
        }
    }
}

@Composable
private fun LegendHeading(text: String) {
    Text(text, Modifier.padding(top = 24.dp, bottom = 12.dp), style = AppTheme.type.h4.copy(fontSize = 20.sp, lineHeight = 25.sp), color = AppTheme.colors.textPrimary)
}

/** Легенда карты для статьи «Как пользоваться картой» (шорткод [[legend]], MapLegend сайта). */
@Composable
fun MapLegend() {
    val c = AppTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        LegendHeading("Транспорт на карте")
        LegendRow("Автобус", "Острый конец капли смотрит туда, куда едет машина, рядом - номер маршрута.") { VehicleSample(TransportType.Bus, "45") }
        LegendRow("Троллейбус") { VehicleSample(TransportType.Troll, "3") }
        LegendRow("Трамвай") { VehicleSample(TransportType.Tram, "15") }
        LegendRow("Низкопольный", "Рядом с номером - знак инвалидной коляски: у машины низкий пол, в неё удобно заехать с коляской.") { VehicleSample(TransportType.Bus, "45", lowFloor = true) }
        LegendRow(
            "Нет данных о маршруте",
            "Жёлтый треугольник: машина едет по направлению, которого нет в нашем справочнике, поэтому её остановки и линию маршрута показать не получится.",
        ) { VehicleSample(TransportType.Bus, "45", warning = true) }

        LegendHeading("Остановки")
        LegendRow("Остановка автобуса") { StopSample(StopKind.Bus) }
        LegendRow("Остановка троллейбуса") { StopSample(StopKind.Troll) }
        LegendRow("Остановка троллейбуса и автобуса") { StopSample(StopKind.TrollBus) }
        LegendRow("Остановка трамвая") { StopSample(StopKind.Tram) }

        LegendHeading("Вокзалы и аэропорт")
        LegendRow("Железнодорожная станция", "Вокзалы и платформы, в карточке - расписание электричек и поездов.") { StationSample("railway_station") }
        LegendRow("Автовокзал", "В карточке - расписание междугородних автобусов.") { StationSample("bus_terminal") }
        LegendRow("Аэропорт", "В карточке - вылеты и прилёты.") { StationSample("airport") }

        LegendHeading("Депо")
        LegendRow("Трамвайное депо") { AreaSample(c.tram) }
        LegendRow("Троллейбусное депо") { AreaSample(c.troll) }
        LegendRow("Автобусный парк", "Территории депо закрашены цветом своего вида транспорта.") { AreaSample(c.bus) }

        LegendHeading("Цвета")
        LegendRow("Зелёный - автобусы", "Машины, остановки, номера и линии маршрутов.") { Swatch(c.bus) }
        LegendRow("Голубой - троллейбусы") { Swatch(c.troll) }
        LegendRow("Оранжевый - трамваи") { Swatch(c.tram) }
        LegendRow("Фиолетовый - поезда и электрички") { Swatch(c.train) }
        LegendRow("Синий - аэропорт") { Swatch(c.airport) }
        LegendRow("Красный - автовокзалы") { Swatch(c.busTerminal) }
        LegendRow("Оранжевая звезда - избранное", "Остановка или маршрут сохранены в избранное.") {
            TablerIcon(R.drawable.tabler_star_filled, null, Modifier.size(24.dp), tint = c.favorite)
        }
        LegendRow("Красная плашка - транспорт не ходит", "Сегодня по остановке или станции нет рейсов, либо расписание не опубликовано.") {
            SiteIcon("no-service", 28.dp, null)
        }
    }
}

@Composable
private fun NotationRow(title: String, sample: @Composable () -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(title, Modifier.weight(1f), style = AppTheme.type.caption, color = AppTheme.colors.textSecondary)
        Box(Modifier.heightIn(min = 32.dp).clearAndSetSemantics {}, contentAlignment = Alignment.Center) { sample() }
    }
}

/** Короткий список обозначений в приветствии (MapWelcomeMessage сайта): подпись слева, значок справа. */
@Composable
fun WelcomeNotations() {
    val c = AppTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        NotationRow("Остановка троллейбуса") { StopSample(StopKind.Troll) }
        NotationRow("Остановка автобуса") { StopSample(StopKind.Bus) }
        NotationRow("Остановка трамвая") { StopSample(StopKind.Tram) }
        NotationRow("Остановка автобуса и троллейбуса") { StopSample(StopKind.TrollBus) }
        NotationRow("Низкопольный транспорт") { FeatureSample { SiteIcon("tram-accessibility", 20.dp, null) } }
        NotationRow("Едет не по маршруту") { FeatureSample { TablerIcon(R.drawable.tabler_alert_triangle, null, Modifier.size(20.dp), tint = c.warning) } }
        NotationRow("Железнодорожная станция") { StationSample("railway_station") }
        NotationRow("Автовокзал") { StationSample("bus_terminal") }
        NotationRow("Аэропорт") { StationSample("airport") }
        NotationRow("Депо и автобусные парки") {
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) { AreaSample(c.tram); AreaSample(c.troll); AreaSample(c.bus) }
        }
    }
}
