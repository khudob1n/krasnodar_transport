package ru.khudob1n.krasnodar.transport.domain

import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import ru.khudob1n.krasnodar.transport.data.LatLngPoint
import ru.khudob1n.krasnodar.transport.data.ScheduleTrip
import ru.khudob1n.krasnodar.transport.data.WalkRoute
import ru.khudob1n.krasnodar.transport.ui.components.TransportType
import kotlinx.datetime.LocalDateTime
import ru.khudob1n.krasnodar.transport.platform.pad2
import kotlin.math.max
import kotlin.math.roundToInt

/** Откуда или куда: остановка или место - адрес, точка на карте, «где я» (places.ts сайта). */
sealed interface JourneyPoint {
    val title: String

    data class StopPoint(val id: Long, override val title: String) : JourneyPoint
    data class PlacePoint(val point: LatLngPoint, override val title: String) : JourneyPoint
}

/** Краснодар с пригородами - та же рамка, по которой собран OSRM (BBOX сайта). */
fun insideCity(p: LatLngPoint) = p.lat > 44.95 && p.lat < 45.2 && p.lng > 38.8 && p.lng < 39.25

/** Сервисы для поиска «от двери до двери»: пешие расстояния и путь по улицам (OSRM). */
interface WalkService {
    suspend fun distances(point: LatLngPoint, targets: List<LatLngPoint>, reverse: Boolean): List<Double?>?
    suspend fun route(from: LatLngPoint, to: LatLngPoint): WalkRoute?
}

// ---------- От двери до двери (doorToDoor.ts) ----------

/** Остановки-кандидаты - в этом радиусе по прямой. */
private const val ACCESS_RADIUS_M = 1200.0
/** Дальше этого по улицам к остановке не идём. */
private const val MAX_PLACE_ACCESS_WALK_M = 1500.0
private const val MAX_CANDIDATES = 50
/** Места ближе этого (по прямой) - предлагаем дойти пешком без транспорта. */
private const val DIRECT_WALK_RADIUS_M = 2500.0

private fun walkOf(to: Long, meters: Double) = Walk(to, meters / WALK_M_PER_MIN, meters)

/** Пешие подходы от места к остановкам (reverse - от остановок к месту). OSRM недоступен - по прямой. */
private suspend fun accessWalks(graph: Graph, point: LatLngPoint, reverse: Boolean, walk: WalkService): List<Walk> {
    val nearest = graph.stops.values.filter { !isPlaceId(it.id) }
        .map { it to distanceMeters(point.lat, point.lng, it.lat, it.lng) }
        .filter { it.second <= ACCESS_RADIUS_M }
        .sortedBy { it.second }
        .take(MAX_CANDIDATES)
    val distances = runCatching { walk.distances(point, nearest.map { LatLngPoint(it.first.lat, it.first.lng) }, reverse) }.getOrNull()
    val walks = nearest.mapIndexedNotNull { i, (stop, straight) ->
        // Пути нет (другой берег реки) - остановку пропускаем.
        val meters = if (distances != null) distances.getOrNull(i) else straight * 1.3
        if (meters == null || meters > MAX_PLACE_ACCESS_WALK_M) null else walkOf(stop.id, meters)
    }
    // Совсем глухое место - хотя бы до ближайшей остановки.
    if (walks.isEmpty() && nearest.isNotEmpty()) return listOf(walkOf(nearest[0].first.id, nearest[0].second * 1.3))
    return walks
}

private suspend fun directWalk(from: LatLngPoint, to: LatLngPoint, walk: WalkService): Double? {
    val straight = distanceMeters(from.lat, from.lng, to.lat, to.lng)
    if (straight > DIRECT_WALK_RADIUS_M) return null
    return runCatching { walk.route(from, to) }.getOrNull()?.meters ?: (straight * 1.3)
}

class Endpoints(val graph: Graph, val fromId: Long, val toId: Long)

/**
 * Граф для поиска между from и to. Если одна из точек - место, в граф добавляется виртуальная
 * остановка с пешими подходами к ближайшим. Базовый граф не меняется: копируются списки.
 */
suspend fun prepareEndpoints(base: Graph, from: JourneyPoint, to: JourneyPoint, walk: WalkService): Endpoints = coroutineScope {
    val fromPlace = (from as? JourneyPoint.PlacePoint)?.point
    val toPlace = (to as? JourneyPoint.PlacePoint)?.point
    val fromId = if (fromPlace != null) ORIGIN_ID else (from as JourneyPoint.StopPoint).id
    val toId = if (toPlace != null) DESTINATION_ID else (to as JourneyPoint.StopPoint).id
    if (fromPlace == null && toPlace == null) return@coroutineScope Endpoints(base, fromId, toId)

    val stops = HashMap(base.stops)
    val walks = HashMap<Long, MutableList<Walk>>(base.walks)
    val origin = async { if (fromPlace != null) accessWalks(base, fromPlace, false, walk) else emptyList() }
    val destination = async { if (toPlace != null) accessWalks(base, toPlace, true, walk) else emptyList() }

    if (fromPlace != null) {
        stops[ORIGIN_ID] = PlannerStop(ORIGIN_ID, from.title, fromPlace.lat, fromPlace.lng)
        walks[ORIGIN_ID] = origin.await().toMutableList()
    }
    if (toPlace != null) {
        stops[DESTINATION_ID] = PlannerStop(DESTINATION_ID, to.title, toPlace.lat, toPlace.lng)
        val list = destination.await()
        walks[DESTINATION_ID] = list.toMutableList()
        // После поездки пассажир идёт от остановки к месту - связь нужна и в эту сторону.
        list.forEach { w -> walks[w.to] = ((walks[w.to] ?: emptyList()) + Walk(DESTINATION_ID, w.minutes, w.meters)).toMutableList() }
    }
    // Пешком без транспорта: место - место, место - остановка, остановка - место.
    val a = fromPlace ?: stops[fromId]?.let { LatLngPoint(it.lat, it.lng) }
    val b = toPlace ?: stops[toId]?.let { LatLngPoint(it.lat, it.lng) }
    if (a != null && b != null) {
        directWalk(a, b, walk)?.let { meters ->
            walks[fromId] = ((walks[fromId] ?: emptyList()).filter { it.to != toId } + walkOf(toId, meters)).toMutableList()
        }
    }
    Endpoints(Graph(stops, base.patterns, base.stopPatterns, walks), fromId, toId)
}

// ---------- Расписание (schedule.ts) ----------

/** Ожидание, если расписания на остановке нет. */
private const val UNKNOWN_WAIT_MIN = 6.0

enum class DepartureSource { Schedule, Estimate }

sealed interface PlannedLeg {
    val leg: Leg

    data class WalkStep(override val leg: Leg.WalkLeg, val start: Double, val end: Double) : PlannedLeg

    data class RideStep(
        override val leg: Leg.RideLeg,
        /** Направление, в которое садимся (из alternatives - с ближайшим рейсом). */
        val chosen: Pattern,
        val chosenBoardIndex: Int,
        val chosenAlightIndex: Int,
        /** Готов к посадке - дошёл или доехал. */
        val ready: Double,
        val departure: Double,
        val arrival: Double,
        val source: DepartureSource,
        /** Сегодня рейсов этого участка больше нет - время отправления условное. */
        val noService: Boolean,
    ) : PlannedLeg
}

class PlannedJourney(
    val itinerary: Itinerary,
    val legs: List<PlannedLeg>,
    /** Всё в минутах от полуночи сегодняшнего дня. */
    val start: Double,
    val arrival: Double,
    /** Сегодня по одному из участков рейсов уже нет. */
    val noServiceToday: Boolean,
    /** Хотя бы одно ожидание оценено без расписания. */
    val approximate: Boolean,
)

fun minutesOfDay(now: LocalDateTime) = now.hour * 60 + now.minute + now.second / 60.0

fun formatClock(minutes: Double): String {
    val total = minutes.roundToInt().mod(24 * 60)
    return "${(total / 60).pad2()}:${(total % 60).pad2()}"
}

private fun toMinutes(time: String): Int = time.split(':').let { it[0].toInt() * 60 + it[1].toInt() }

private val TransportType.ru get() = when (this) { TransportType.Bus -> "Автобус"; TransportType.Troll -> "Троллейбус"; TransportType.Tram -> "Трамвай" }

private sealed interface Found {
    data class At(val time: Double) : Found
    /** Расписание маршрута на остановке есть, но сегодня рейсов больше нет. */
    data object None : Found
}

/** Ближайшее отправление направления с остановки не раньше after; null - расписания нет вовсе. */
private fun nextDeparture(trips: List<ScheduleTrip>, pattern: Pattern, dayType: String, after: Double): Found? {
    val ofRoute = trips.filter { it.routeType == pattern.type.ru && it.routeNumber == pattern.number && it.dayType == dayType }
    val exact = ofRoute.filter { it.toStation == pattern.directionTo }
    // Конечная в расписании иногда записана иначе. Если маршрут здесь идёт в одну сторону - это она.
    val same = exact.ifEmpty { if (ofRoute.map { it.toStation }.toSet().size == 1) ofRoute else emptyList() }
    if (same.isEmpty()) return null
    val time = same.map { toMinutes(it.time).toDouble() }.filter { it >= after }.minOrNull()
    return if (time != null) Found.At(time) else Found.None
}

private suspend fun planSchedule(itinerary: Itinerary, now: LocalDateTime, loadSchedule: suspend (Long) -> List<ScheduleTrip>): PlannedJourney {
    val dayType = dayTypeOf(now)
    val start = minutesOfDay(now)
    var clock = start
    var noServiceToday = false
    var approximate = false
    val legs = mutableListOf<PlannedLeg>()

    for (leg in itinerary.legs) {
        when (leg) {
            is Leg.WalkLeg -> {
                legs += PlannedLeg.WalkStep(leg, clock, clock + leg.minutes)
                clock += leg.minutes
            }
            is Leg.RideLeg -> {
                val ready = clock
                val trips = runCatching { loadSchedule(leg.from) }.getOrDefault(emptyList())
                val options = leg.alternatives.ifEmpty { listOf(Alternative(leg.pattern, leg.boardIndex, leg.alightIndex)) }
                data class Choice(val option: Alternative, val departure: Double, val source: DepartureSource)
                fun Alternative.ride() = pattern.cumulative[alightIndex] - pattern.cumulative[boardIndex]
                var chosen: Choice? = null
                var allNone = true
                for (option in options) {
                    val found = nextDeparture(trips, option.pattern, dayType, ready)
                    if (found == Found.None) continue
                    allNone = false
                    val departure = (found as? Found.At)?.time ?: (ready + UNKNOWN_WAIT_MIN)
                    val source = if (found != null) DepartureSource.Schedule else DepartureSource.Estimate
                    val arrival = departure + option.ride()
                    val current = chosen?.let { it.departure + it.option.ride() } ?: Double.POSITIVE_INFINITY
                    // Рейс по расписанию надёжнее оценки при равном времени прибытия.
                    if (arrival < current - 0.5 || (arrival <= current + 0.5 && chosen?.source == DepartureSource.Estimate && found != null)) {
                        chosen = Choice(option, departure, source)
                    }
                }
                val noService = allNone || chosen == null
                if (noService) {
                    noServiceToday = true
                    chosen = Choice(options[0], ready + UNKNOWN_WAIT_MIN, DepartureSource.Estimate)
                }
                val c = chosen!!
                if (c.source == DepartureSource.Estimate) approximate = true
                val arrival = c.departure + c.option.ride()
                legs += PlannedLeg.RideStep(leg, c.option.pattern, c.option.boardIndex, c.option.alightIndex, ready, c.departure, arrival, c.source, noService)
                clock = arrival
            }
        }
    }
    return PlannedJourney(itinerary, legs, start, clock, noServiceToday, approximate)
}

/** Варианты по времени прибытия; те, где сегодня уже не уехать, - в конце. */
suspend fun planSchedules(itineraries: List<Itinerary>, now: LocalDateTime, loadSchedule: suspend (Long) -> List<ScheduleTrip>): List<PlannedJourney> = coroutineScope {
    itineraries.map { async { planSchedule(it, now, loadSchedule) } }.awaitAll()
        .sortedWith(compareBy<PlannedJourney> { it.noServiceToday }.thenBy { it.arrival + 3 * max(0, it.itinerary.rides - 1) })
}

// ---------- Шаги (steps.ts) ----------

/** Переходы в пару десятков метров - та же остановка через дорогу, отдельным шагом не показываем. */
const val MIN_WALK_TO_SHOW_M = 40.0

/** Шаги варианта, которые видит пассажир, - индексы в journey.legs. */
fun visibleLegIndices(journey: PlannedJourney) = journey.legs.indices.filter { i ->
    val leg = journey.legs[i].leg
    leg is Leg.RideLeg || (leg as Leg.WalkLeg).meters >= MIN_WALK_TO_SHOW_M ||
        // Путь от своего места до остановки показываем всегда, даже если она у подъезда.
        isPlaceId(leg.from) || isPlaceId(leg.to)
}
