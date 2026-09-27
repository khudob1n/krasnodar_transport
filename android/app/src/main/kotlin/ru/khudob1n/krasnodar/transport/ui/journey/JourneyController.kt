package ru.khudob1n.krasnodar.transport.ui.journey

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ru.khudob1n.krasnodar.transport.data.Catalog
import ru.khudob1n.krasnodar.transport.data.ScheduleTrip
import ru.khudob1n.krasnodar.transport.domain.DESTINATION_ID
import ru.khudob1n.krasnodar.transport.domain.Graph
import ru.khudob1n.krasnodar.transport.domain.ORIGIN_ID
import ru.khudob1n.krasnodar.transport.domain.JourneyPoint
import ru.khudob1n.krasnodar.transport.domain.PlannedJourney
import ru.khudob1n.krasnodar.transport.domain.WalkService
import ru.khudob1n.krasnodar.transport.domain.buildGraph
import ru.khudob1n.krasnodar.transport.domain.cityNow
import ru.khudob1n.krasnodar.transport.domain.planJourneys
import ru.khudob1n.krasnodar.transport.domain.planSchedules
import ru.khudob1n.krasnodar.transport.domain.prepareEndpoints
import java.time.ZonedDateTime

enum class JourneyStatus { Idle, Loading, Done, Error }

/**
 * Состояние панели «Маршрут» (services/journey/journeyStore.ts сайта): откуда, куда, найденные
 * варианты и выбранный. Поиск запускается сам, как только заданы обе точки.
 */
class JourneyController(
    private val scope: CoroutineScope,
    private val walk: WalkService,
    private val loadSchedule: suspend (Long) -> List<ScheduleTrip>,
) {
    var from by mutableStateOf<JourneyPoint?>(null)
        private set
    var to by mutableStateOf<JourneyPoint?>(null)
        private set
    var status by mutableStateOf(JourneyStatus.Idle)
        private set
    var journeys by mutableStateOf<List<PlannedJourney>>(emptyList())
        private set
    var selected by mutableIntStateOf(0)
    /** Навигатор «Поехали»: номер шага или null - список вариантов. */
    var navStep by mutableStateOf<Int?>(null)
    var plannedAt by mutableStateOf<ZonedDateTime?>(null)
        private set
    /** Сколько пересадок разрешено (настройка «Пересадок не больше») - при поиске. */
    var maxTransfers by mutableIntStateOf(2)
        private set

    /** Граф последнего поиска - в нём и места «откуда/куда» под виртуальными id. */
    private var searchGraph: Graph? = null

    /** Название остановки или места в шагах маршрута. */
    fun nameOf(id: Long): String = when (id) {
        ORIGIN_ID -> from?.title
        DESTINATION_ID -> to?.title
        else -> searchGraph?.stops?.get(id)?.name
    }.orEmpty()

    /** Координаты остановки или места - для линии маршрута на карте. */
    fun pointOf(id: Long) = searchGraph?.stops?.get(id)

    private var catalog: Catalog? = null
    private var graph: Graph? = null
    private var job: Job? = null

    /** Граф строится один раз на справочник (сотни направлений - доли секунды). */
    fun setCatalog(catalog: Catalog?) {
        if (catalog === this.catalog) return
        this.catalog = catalog
        graph = null
        search()
    }

    fun changeMaxTransfers(value: Int) {
        if (value == maxTransfers) return
        maxTransfers = value
        search()
    }

    // Та же точка с новой подписью (пришёл адрес) - искать заново незачем.
    fun changeFrom(point: JourneyPoint?) { val again = !samePoint(from, point); from = point; if (again) search() }
    fun changeTo(point: JourneyPoint?) { val again = !samePoint(to, point); to = point; if (again) search() }

    private fun samePoint(a: JourneyPoint?, b: JourneyPoint?) = a != null && b != null && same(a, b)

    /** Задать обе точки сразу («Отсюда» / «Сюда» в карточке остановки). */
    fun setBoth(from: JourneyPoint?, to: JourneyPoint?) { this.from = from; this.to = to; search() }

    fun swap() { val a = from; from = to; to = a; search() }

    fun clear() { job?.cancel(); from = null; to = null; journeys = emptyList(); status = JourneyStatus.Idle }

    /** Пересчитать отправления: панель висит открытой, время ушло. Во время навигации не трогаем. */
    fun refresh() { if (navStep == null) search(keepSelection = true) }

    fun select(index: Int) { selected = index; navStep = null }

    private fun same(a: JourneyPoint, b: JourneyPoint) = when {
        a is JourneyPoint.StopPoint && b is JourneyPoint.StopPoint -> a.id == b.id
        a is JourneyPoint.PlacePoint && b is JourneyPoint.PlacePoint -> a.point == b.point
        else -> false
    }

    /** Откуда и куда - одно и то же место. */
    val samePoints get() = from?.let { f -> to?.let { t -> same(f, t) } } == true

    private fun search(keepSelection: Boolean = false) {
        job?.cancel()
        val a = from
        val b = to
        val c = catalog
        if (a == null || b == null || same(a, b) || c == null) {
            journeys = emptyList()
            status = JourneyStatus.Idle
            return
        }
        // Пересчёт открытых вариантов - тихо (silent у сайта): список остаётся, пока не придёт новый.
        if (!keepSelection || journeys.isEmpty()) status = JourneyStatus.Loading
        val previous = if (keepSelection) selected else 0
        job = scope.launch {
            runCatching {
                val base = graph ?: withContext(Dispatchers.Default) { buildGraph(c.routeStops) }.also { graph = it }
                val endpoints = prepareEndpoints(base, a, b, walk)
                val itineraries = withContext(Dispatchers.Default) {
                    planJourneys(endpoints.graph, endpoints.fromId, endpoints.toId, maxRides = maxTransfers + 1)
                }
                val now = cityNow()
                Triple(planSchedules(itineraries, now, loadSchedule), now, endpoints.graph)
            }.onSuccess { (planned, now, g) ->
                searchGraph = g
                journeys = planned
                selected = previous.coerceIn(0, maxOf(0, planned.size - 1))
                plannedAt = now
                status = JourneyStatus.Done
            }.onFailure {
                if (it is kotlinx.coroutines.CancellationException) throw it
                // Тихий пересчёт не удался - остаются прежние варианты.
                if (!keepSelection || journeys.isEmpty()) status = JourneyStatus.Error
            }
        }
    }
}
