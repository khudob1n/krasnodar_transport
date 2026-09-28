package ru.khudob1n.krasnodar.transport.domain

import ru.khudob1n.krasnodar.transport.data.RouteStops
import ru.khudob1n.krasnodar.transport.ui.components.TransportType
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

/*
 * Поиск маршрута между двумя остановками с пересадками - перенос services/journey/planner.ts
 * сайта (без метро: в Краснодаре его нет).
 *
 * Данные - только статические: последовательности остановок по направлениям маршрутов
 * (route_stops) и их координаты. Прогноза движения нет, поэтому время в пути оценивается по
 * расстоянию, а ожидание - условным штрафом. Реальные отправления по расписанию
 * подставляются потом, уже для найденных вариантов (JourneySchedule).
 *
 * Алгоритм - упрощённый RAPTOR: раунд k находит лучшее время до каждой остановки не больше
 * чем за k поездок. После каждой поездки можно пройти пешком до соседней остановки.
 */

/**
 * Места «откуда» и «куда», если это не остановка, а адрес или точка на карте: в графе они -
 * две виртуальные остановки с пешими подходами к ближайшим настоящим (DoorToDoor).
 */
const val ORIGIN_ID = 1_000_000_001L
const val DESTINATION_ID = 1_000_000_002L
fun isPlaceId(id: Long) = id == ORIGIN_ID || id == DESTINATION_ID

data class PlannerStop(val id: Long, val name: String, val lat: Double, val lng: Double)

/** Одно направление маршрута - то, на что садятся. */
data class Pattern(
    val routeId: Long,
    val subrouteId: Long,
    val number: String,
    val type: TransportType,
    val directionTo: String,
    val stops: List<Long>,
    /** Минуты от первой остановки направления до каждой следующей. */
    val cumulative: List<Double>,
)

data class Walk(val to: Long, val minutes: Double, val meters: Double)

class Graph(
    val stops: MutableMap<Long, PlannerStop>,
    val patterns: List<Pattern>,
    /** Остановка -> [направление, позиция в нём]. */
    val stopPatterns: Map<Long, List<Pair<Int, Int>>>,
    /** Остановка -> соседние остановки в пешей доступности. */
    val walks: MutableMap<Long, MutableList<Walk>>,
)

data class Alternative(val pattern: Pattern, val boardIndex: Int, val alightIndex: Int)

sealed interface Leg {
    val from: Long
    val to: Long
    val minutes: Double

    data class WalkLeg(override val from: Long, override val to: Long, override val minutes: Double, val meters: Double) : Leg

    data class RideLeg(
        val pattern: Pattern,
        override val from: Long,
        override val to: Long,
        val boardIndex: Int,
        val alightIndex: Int,
        override val minutes: Double,
        /**
         * Все направления, которые везут от from до to примерно за столько же остановок -
         * параллельные маршруты на общем участке. Первым идёт pattern; ближайший рейс любого
         * из них выбирается по расписанию.
         */
        var alternatives: List<Alternative> = emptyList(),
    ) : Leg
}

data class Itinerary(
    val legs: List<Leg>,
    /** Оценка без расписания: пешком + ожидание + в пути. */
    val estimatedMinutes: Double,
    /** 0 - весь путь пешком. */
    val rides: Int,
)

// Скорости «на ходу», без остановок: стоянка учтена на каждой промежуточной остановке.
// Путь по улицам длиннее прямой - коэффициент извилистости.
private fun runSpeed(type: TransportType) = when (type) {
    TransportType.Tram -> 360.0 // ~22 км/ч
    TransportType.Troll -> 350.0 // ~21 км/ч
    TransportType.Bus -> 420.0 // ~25 км/ч
}
private const val DETOUR = 1.2
private const val DWELL_MIN = 0.4

const val WALK_M_PER_MIN = 70.0 // ~4,2 км/ч
private const val WALK_DETOUR = 1.3
private const val MAX_TRANSFER_WALK_M = 400.0
/** От выбранной остановки можно дойти до соседней, если так быстрее (другая сторона улицы). */
private const val MAX_ACCESS_WALK_M = 300.0

// У места «откуда/куда» подходы уже отобраны по расстоянию при построении графа.
private fun accessLimit(from: Long, to: Long) = if (isPlaceId(from) || isPlaceId(to)) Double.POSITIVE_INFINITY else MAX_ACCESS_WALK_M

/** Условное ожидание на посадке. Настоящее считается по расписанию после поиска. */
private const val BOARD_WAIT_MIN = 5.0
/** Пересадка неудобна сама по себе: без штрафа поиск меняет 1 поездку на 3 ради минуты. */
private const val TRANSFER_PENALTY_MIN = 4.0

/** Поездок по умолчанию (2 пересадки); пассажир меняет в настройках (maxTransfers). */
const val MAX_RIDES = 3

fun distanceMeters(aLat: Double, aLng: Double, bLat: Double, bLng: Double): Double {
    val r = 6371000.0
    fun rad(d: Double) = d * kotlin.math.PI / 180
    val dLat = rad(bLat - aLat)
    val dLng = rad(bLng - aLng)
    val h = sin(dLat / 2).pow(2) + cos(rad(aLat)) * cos(rad(bLat)) * sin(dLng / 2).pow(2)
    return 2 * r * asin(sqrt(h))
}

private fun distance(a: PlannerStop, b: PlannerStop) = distanceMeters(a.lat, a.lng, b.lat, b.lng)

fun walkMinutes(meters: Double) = meters * WALK_DETOUR / WALK_M_PER_MIN

fun buildGraph(rows: Collection<RouteStops>): Graph {
    val stops = LinkedHashMap<Long, PlannerStop>()
    val patterns = mutableListOf<Pattern>()
    val stopPatterns = HashMap<Long, MutableList<Pair<Int, Int>>>()

    for (row in rows) {
        val type = row.transport ?: continue
        for (direction in row.directions) {
            // Одна и та же остановка подряд (бывает у разворотов) - лишний шаг.
            val stations = direction.stations.filterIndexed { i, s -> i == 0 || direction.stations[i - 1].id != s.id }
            if (stations.size < 2) continue
            val cumulative = mutableListOf(0.0)
            for (i in 1 until stations.size) {
                val meters = distanceMeters(stations[i - 1].lat, stations[i - 1].lng, stations[i].lat, stations[i].lng) * DETOUR
                cumulative += cumulative[i - 1] + meters / runSpeed(type) + DWELL_MIN
            }
            val patternIndex = patterns.size
            patterns += Pattern(row.id, direction.subrouteId, row.number, type, direction.directionTo, stations.map { it.id }, cumulative)
            stations.forEachIndexed { position, s ->
                stops.getOrPut(s.id) { PlannerStop(s.id, s.name, s.lat, s.lng) }
                stopPatterns.getOrPut(s.id) { mutableListOf() } += patternIndex to position
            }
        }
    }
    return Graph(stops, patterns, stopPatterns, buildWalks(stops))
}

// Сетка ~500 м, чтобы не сравнивать каждую остановку с каждой.
private fun buildWalks(stops: Map<Long, PlannerStop>): MutableMap<Long, MutableList<Walk>> {
    val cell = 0.005
    fun key(row: Int, col: Int) = row.toLong() shl 32 or (col.toLong() and 0xffffffffL)
    val grid = HashMap<Long, MutableList<PlannerStop>>()
    for (s in stops.values) grid.getOrPut(key(floor(s.lat / cell).toInt(), floor(s.lng / (cell * 2)).toInt())) { mutableListOf() } += s
    val walks = HashMap<Long, MutableList<Walk>>()
    for (s in stops.values) {
        val row = floor(s.lat / cell).toInt()
        val col = floor(s.lng / (cell * 2)).toInt()
        val list = mutableListOf<Walk>()
        for (dr in -1..1) for (dc in -1..1) {
            grid[key(row + dr, col + dc)]?.forEach { other ->
                if (other.id == s.id) return@forEach
                val meters = distance(s, other)
                if (meters <= MAX_TRANSFER_WALK_M) list += Walk(other.id, walkMinutes(meters), meters)
            }
        }
        walks[s.id] = list
    }
    return walks
}

private sealed interface Parent {
    data object Origin : Parent
    data class ByWalk(val from: Long, val meters: Double, val minutes: Double) : Parent
    data class ByRide(val pattern: Int, val from: Long, val boardIndex: Int, val alightIndex: Int) : Parent
}

/**
 * Лучший вариант для каждого числа поездок (1..maxRides). Вариант с большим числом
 * пересадок попадает в результат, только если он заметно быстрее.
 */
private fun search(graph: Graph, fromId: Long, toId: Long, banned: Set<Long>, maxRides: Int): List<Itinerary> {
    val stops = graph.stops
    val patterns = graph.patterns
    val walks = graph.walks
    if (fromId !in stops) return emptyList()
    val destination = stops[toId] ?: return emptyList()

    // Подход пешком к выбранной остановке «куда».
    val egress = hashMapOf(toId to 0.0)
    walks[toId]?.forEach { if (it.meters <= accessLimit(toId, it.to)) egress[it.to] = it.minutes }

    val labels = mutableListOf(HashMap<Long, Double>())
    val parents = mutableListOf(HashMap<Long, Parent>())
    val best = HashMap<Long, Double>()
    fun setLabel(round: Int, stop: Long, value: Double, parent: Parent) {
        labels[round][stop] = value
        parents[round][stop] = parent
        best[stop] = value
    }

    setLabel(0, fromId, 0.0, Parent.Origin)
    // Прямо к цели пешком - отдельный вариант (planJourneys): здесь такая метка отсекла бы
    // все поездки медленнее пешехода.
    walks[fromId]?.forEach { if (it.to != toId && it.meters <= accessLimit(fromId, it.to)) setLabel(0, it.to, it.minutes, Parent.ByWalk(fromId, it.meters, it.minutes)) }

    var marked: Set<Long> = labels[0].keys.toSet()
    fun targetCost(): Double {
        var result = Double.POSITIVE_INFINITY
        egress.forEach { (stop, walk) -> best[stop]?.let { result = min(result, it + walk) } }
        return result
    }

    data class RoundBest(val round: Int, val cost: Double, val stop: Long)
    val results = mutableListOf<RoundBest>()

    var round = 1
    while (round <= maxRides && marked.isNotEmpty()) {
        labels += HashMap()
        parents += HashMap()
        val previous = labels[round - 1]
        val improved = LinkedHashSet<Long>()

        // Для каждого направления - самая ранняя отмеченная остановка на нём.
        val queue = HashMap<Int, Int>()
        for (stop in marked) {
            graph.stopPatterns[stop]?.forEach { (patternIndex, position) ->
                if (patterns[patternIndex].routeId in banned) return@forEach
                val current = queue[patternIndex]
                if (current == null || position < current) queue[patternIndex] = position
            }
        }

        val transferPenalty = if (round > 1) TRANSFER_PENALTY_MIN else 0.0
        for ((patternIndex, startPosition) in queue) {
            val pattern = patterns[patternIndex]
            val boardPenalty = BOARD_WAIT_MIN + transferPenalty
            var boardPosition = -1
            var boardBase = Double.POSITIVE_INFINITY // стоимость посадки минус cumulative[boardPosition]
            for (position in startPosition until pattern.stops.size) {
                val stop = pattern.stops[position]
                if (boardPosition >= 0) {
                    val arrival = boardBase + pattern.cumulative[position]
                    val bound = min(best[stop] ?: Double.POSITIVE_INFINITY, targetCost())
                    if (arrival < bound) {
                        setLabel(round, stop, arrival, Parent.ByRide(patternIndex, pattern.stops[boardPosition], boardPosition, position))
                        improved += stop
                    }
                }
                val ready = previous[stop]
                if (ready != null) {
                    val base = ready + boardPenalty - pattern.cumulative[position]
                    if (base < boardBase) {
                        boardBase = base
                        boardPosition = position
                    }
                }
            }
        }

        // Пешие переходы после поездки - по одному, двух подряд не бывает.
        val walked = LinkedHashSet<Long>()
        for (stop in improved) {
            val value = labels[round][stop]!!
            walks[stop]?.forEach { w ->
                val arrival = value + w.minutes
                if (arrival < min(best[w.to] ?: Double.POSITIVE_INFINITY, targetCost())) {
                    setLabel(round, w.to, arrival, Parent.ByWalk(stop, w.meters, w.minutes))
                    walked += w.to
                }
            }
        }
        marked = improved + walked

        // Лучший выход к цели в этом раунде.
        var roundBest: RoundBest? = null
        egress.forEach { (stop, walk) ->
            val value = labels[round][stop] ?: return@forEach
            // Заканчивать пешком на walk-метке - два перехода подряд.
            if (walk > 0 && parents[round][stop] is Parent.ByWalk) return@forEach
            val cost = value + walk
            if (roundBest == null || cost < roundBest!!.cost) roundBest = RoundBest(round, cost, stop)
        }
        roundBest?.let { results += it }
        round++
    }

    val itineraries = mutableListOf<Itinerary>()
    var bestSoFar = Double.POSITIVE_INFINITY
    for ((r, cost, stop) in results) {
        // Лишняя пересадка должна окупаться хотя бы парой минут.
        if (cost >= bestSoFar - 2) continue
        val legs = reconstruct(graph, parents, r, stop)?.toMutableList() ?: continue
        if (stop != toId) {
            val link = walks[stop]?.firstOrNull { it.to == toId }
            val meters = link?.meters ?: distance(stops.getValue(stop), destination)
            legs += Leg.WalkLeg(stop, toId, link?.minutes ?: walkMinutes(meters), meters)
        }
        bestSoFar = cost
        itineraries += Itinerary(legs, cost, legs.count { it is Leg.RideLeg })
    }
    return itineraries
}

private fun reconstruct(graph: Graph, parents: List<Map<Long, Parent>>, round: Int, stop: Long): List<Leg>? {
    val legs = mutableListOf<Leg>()
    var currentRound = round
    var current = stop
    repeat(20) {
        when (val parent = parents[currentRound][current] ?: return null) {
            Parent.Origin -> return legs.reversed()
            is Parent.ByWalk -> {
                legs += Leg.WalkLeg(parent.from, current, parent.minutes, parent.meters)
                current = parent.from
            }
            is Parent.ByRide -> {
                val pattern = graph.patterns[parent.pattern]
                legs += Leg.RideLeg(
                    pattern, parent.from, current, parent.boardIndex, parent.alightIndex,
                    pattern.cumulative[parent.alightIndex] - pattern.cumulative[parent.boardIndex],
                )
                current = parent.from
                currentRound -= 1
            }
        }
    }
    return null
}

private fun Itinerary.rideLegs() = legs.filterIsInstance<Leg.RideLeg>()

/** Параллельные направления для поездки: те же остановки посадки и выхода, не намного больше остановок. */
private fun fillAlternatives(graph: Graph, leg: Leg.RideLeg) {
    val stopsCount = leg.alightIndex - leg.boardIndex
    val found = mutableListOf(Alternative(leg.pattern, leg.boardIndex, leg.alightIndex))
    graph.stopPatterns[leg.from]?.forEach { (patternIndex, boardIndex) ->
        val pattern = graph.patterns[patternIndex]
        if (pattern == leg.pattern || found.any { it.pattern.routeId == pattern.routeId }) return@forEach
        val alightIndex = pattern.stops.subList(boardIndex + 1, pattern.stops.size).indexOf(leg.to).let { if (it < 0) -1 else it + boardIndex + 1 }
        if (alightIndex > 0 && alightIndex - boardIndex <= stopsCount + 2) found += Alternative(pattern, boardIndex, alightIndex)
    }
    leg.alternatives = found
}

// Одинаковые по остановкам варианты (разными параллельными маршрутами) - один вариант.
private fun Itinerary.signature() = rideLegs().joinToString(">") { "${it.from}-${it.to}" }

/** Пересадка должна окупаться: при сравнении каждая стоит столько минут. */
private const val TRANSFER_WEIGHT_MIN = 7.0
private fun Itinerary.score() = estimatedMinutes + TRANSFER_WEIGHT_MIN * max(0, rides - 1)

/**
 * Несколько разных вариантов: после каждого поиска запрещаем маршруты самой долгой поездки
 * лучшего варианта (вместе с параллельными) и ищем снова.
 */
fun planJourneys(graph: Graph, fromId: Long, toId: Long, maxOptions: Int = 4, maxRides: Int = MAX_RIDES): List<Itinerary> {
    if (fromId == toId) return emptyList()
    val found = LinkedHashMap<String, Itinerary>()
    val banned = HashSet<Long>()
    var attempt = 0
    while (attempt < 6 && found.size < maxOptions + 2) {
        val itineraries = search(graph, fromId, toId, banned, maxRides)
        if (itineraries.isEmpty()) break
        for (it in itineraries) {
            it.rideLegs().forEach { leg -> fillAlternatives(graph, leg) }
            found.getOrPut(it.signature()) { it }
        }
        val main = itineraries.minBy { it.score() }
        val longest = main.rideLegs().maxByOrNull { it.minutes } ?: break
        longest.alternatives.forEach { banned += it.pattern.routeId }
        attempt++
    }
    // Близко - можно и пешком. Прямая связь есть, только если места рядом.
    graph.walks[fromId]?.firstOrNull { it.to == toId }?.let { direct ->
        found["walk"] = Itinerary(listOf(Leg.WalkLeg(fromId, toId, direct.minutes, direct.meters)), direct.minutes, 0)
    }
    val sorted = found.values.sortedBy { it.score() }
    val bestScore = sorted.firstOrNull()?.score() ?: 0.0
    // Варианты намного хуже лучшего только загромождают список.
    return sorted.filter { it.score() <= bestScore + 25 }.take(maxOptions)
}
