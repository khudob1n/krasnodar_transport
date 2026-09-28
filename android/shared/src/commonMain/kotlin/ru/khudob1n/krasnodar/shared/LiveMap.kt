package ru.khudob1n.krasnodar.shared

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import org.maplibre.compose.camera.CameraPosition
import org.maplibre.compose.map.MapState
import org.maplibre.compose.map.MaplibreMap
import org.maplibre.compose.map.rememberMapState
import org.maplibre.compose.style.BaseStyle
import org.maplibre.spatialk.geojson.Position
import kotlin.time.TimeSource

private val BUS = Color(0xFF00B400)
private val TROLL = Color(0xFF00B4FF)
private val TRAM = Color(0xFFFF640F)

private fun TransportType.color() = when (this) {
    TransportType.Bus -> BUS
    TransportType.Troll -> TROLL
    TransportType.Tram -> TRAM
}

private class Track(var vehicle: Vehicle, val type: TransportType, val motion: VehicleMotion)

/**
 * Проверка карты на iPhone: подложка сайта через maplibre-compose, живые машины своим слоем
 * поверх карты (каждая целиком, южнее - поверх) и плавное движение по линии маршрута - то же,
 * что в Android-приложении (VehicleOverlay + VehicleMotion).
 */
@Composable
fun LiveMap(modifier: Modifier = Modifier) {
    val api = remember { Api() }
    val clock = remember { TimeSource.Monotonic.markNow() }
    val tracks = remember { LinkedHashMap<String, Track>() }
    val lines = remember { HashMap<Long, RouteLine>() }
    var frame by remember { mutableLongStateOf(0L) }

    LaunchedEffect(Unit) {
        runCatching { api.geometry() }.onSuccess { list ->
            for (g in list) if (g.points.size >= 2) lines[g.subrouteId] = RouteLine(g.points)
        }
    }
    // Машины - раз в 5 секунд, как в приложении и на сайте.
    LaunchedEffect(Unit) {
        while (true) {
            runCatching { api.vehicles() }.onSuccess { list ->
                val now = clock.elapsedNow().inWholeMilliseconds
                val seen = HashSet<String>()
                for (v in list) {
                    val type = v.transport ?: continue
                    seen += v.deviceCode
                    val track = tracks[v.deviceCode]
                    if (track == null) {
                        tracks[v.deviceCode] = Track(v, type, VehicleMotion(lines[v.subrouteId], v.lat, v.lng, v.dir, now))
                    } else {
                        val was = track.vehicle
                        track.vehicle = v
                        if (was.lat != v.lat || was.lng != v.lng || was.dir != v.dir || was.subrouteId != v.subrouteId) {
                            track.motion.fix(v.lat, v.lng, v.dir, now, lines[v.subrouteId])
                        }
                    }
                }
                tracks.keys.retainAll(seen)
            }
            delay(5_000)
        }
    }
    // Каждый кадр - сдвинуть машины; Canvas читает frame и перерисовывается.
    LaunchedEffect(Unit) {
        while (true) {
            withFrameMillis {
                val now = clock.elapsedNow().inWholeMilliseconds
                for (t in tracks.values) t.motion.advance(now)
                frame = now
            }
        }
    }

    var style by remember { mutableStateOf<BaseStyle>(BaseStyle.Json("{\"version\":8,\"sources\":{},\"layers\":[{\"id\":\"bg\",\"type\":\"background\",\"paint\":{\"background-color\":\"#F7F6F3\"}}]}")) }
    LaunchedEffect(Unit) { runCatching { api.mapStyle(dark = false) }.onSuccess { style = BaseStyle.Json(it) } }
    val mapState = rememberMapState(
        baseStyle = style,
        initialCameraPosition = CameraPosition(target = Position(longitude = 38.975, latitude = 45.035), zoom = 13.5),
    )
    val measurer = rememberTextMeasurer()
    val labels = remember { HashMap<String, TextLayoutResult>() }
    MaplibreMap(
        modifier = modifier,
        state = mapState,
        overlay = {
            Canvas(Modifier.fillMaxSize()) {
                frame // перерисовка каждый кадр
                if (mapState.viewport == null) return@Canvas
                drawVehicles(mapState, tracks.values, measurer, labels)
            }
        },
    )
}

private fun DrawScope.drawVehicles(state: MapState, tracks: Collection<Track>, measurer: TextMeasurer, labels: HashMap<String, TextLayoutResult>) {
    val bearing = state.cameraPosition.bearing.toFloat()
    val margin = 120.dp.toPx()
    // Севернее - раньше, южнее - поверх (z-index по широте у Leaflet).
    for (t in tracks.sortedByDescending { it.motion.lat }) {
        val p = state.screenLocationFromPosition(Position(longitude = t.motion.lng, latitude = t.motion.lat)) ?: continue
        val x = p.x.toPx()
        val y = p.y.toPx()
        if (x < -margin || y < -margin || x > size.width + margin || y > size.height + margin) continue
        val color = t.type.color()
        val center = Offset(x, y)
        // Капля: круг и острие по курсу.
        rotate(t.motion.dir.toFloat() - bearing, center) {
            val r = 15.dp.toPx()
            // Капля: острие по курсу, стороны - касательные к кругу.
            val tip = 27.dp.toPx()
            val phi = kotlin.math.asin(r / tip)
            val phiDeg = (phi * 180 / kotlin.math.PI).toFloat()
            val drop = Path().apply {
                moveTo(x, y - tip)
                arcTo(androidx.compose.ui.geometry.Rect(center, r), -phiDeg, 180f + 2 * phiDeg, false)
                close()
            }
            drawPath(drop, Color.White)
            drawPath(drop, color, style = Stroke(width = 2.5f.dp.toPx()))
        }
        drawCircle(color, radius = 6.dp.toPx(), center = center)
        // Номер маршрута - бейджем справа.
        val label = labels.getOrPut(t.vehicle.routeNumber) {
            measurer.measure(t.vehicle.routeNumber, TextStyle(fontSize = 17.sp, fontWeight = FontWeight.Medium))
        }
        val w = maxOf(34.dp.toPx(), label.size.width + 10.dp.toPx())
        val h = 22.dp.toPx()
        val left = x + 22.dp.toPx()
        val top = y - h / 2
        drawRoundRect(color, Offset(left - 2.dp.toPx(), top - 2.dp.toPx()), Size(w + 4.dp.toPx(), h + 4.dp.toPx()), CornerRadius(9.dp.toPx()))
        drawRoundRect(Color.White, Offset(left, top), Size(w, h), CornerRadius(7.dp.toPx()))
        drawText(label, color = color, topLeft = Offset(left + (w - label.size.width) / 2, top + (h - label.size.height) / 2))
    }
}
