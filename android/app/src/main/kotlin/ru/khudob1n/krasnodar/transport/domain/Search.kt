package ru.khudob1n.krasnodar.transport.domain

import ru.khudob1n.krasnodar.transport.data.Catalog
import ru.khudob1n.krasnodar.transport.data.Depot
import ru.khudob1n.krasnodar.transport.data.RailStation
import ru.khudob1n.krasnodar.transport.data.RouteStops
import ru.khudob1n.krasnodar.transport.data.Stop
import ru.khudob1n.krasnodar.transport.map.StopKind
import ru.khudob1n.krasnodar.transport.map.stopKindOf
import ru.khudob1n.krasnodar.transport.ui.components.TransportType
import java.text.Collator
import java.util.Locale

// Поиск по справочнику - components/Map/SearchBar/SearchBar.helpers.ts сайта один в один.

/** Регистр не важен, «ё» = «е». */
fun normalizeSearch(text: String) = text.trim().lowercase().replace('ё', 'е')

private fun matches(text: String, query: String) = normalizeSearch(text).contains(query)

private val collator: Collator = Collator.getInstance(Locale.forLanguageTag("ru"))

/** Сравнение «по-человечески»: номера 2, 2Е, 10 - по числу, дальше по буквам. */
private val byName = Comparator<String> { a, b ->
    val na = a.takeWhile(Char::isDigit).toIntOrNull()
    val nb = b.takeWhile(Char::isDigit).toIntOrNull()
    if (na != null && nb != null && na != nb) na.compareTo(nb) else collator.compare(a, b)
}

private val ROUTE_TYPE_NAMES = listOf(
    Triple(TransportType.Tram, "трамвай", listOf("тм")),
    Triple(TransportType.Troll, "троллейбус", listOf("тб")),
    Triple(TransportType.Bus, "автобус", listOf("а", "авт")),
)

private fun routeTypesOf(word: String): List<TransportType> {
    val exact = ROUTE_TYPE_NAMES.filter { word in it.third }
    if (exact.isNotEmpty()) return exact.map { it.first }
    if (word.isEmpty()) return emptyList()
    return ROUTE_TYPE_NAMES.filter { (_, name) -> name.startsWith(word) || word.startsWith(name.dropLast(1)) }.map { it.first }
}

/** «трамвай 8», «8 т», «тб 5» - вид и номер в любом порядке; «трамваи» - все маршруты вида. */
private fun typedRouteQuery(query: String): Pair<List<TransportType>, String?>? {
    val words = query.split(Regex("\\s+"))
    if (words.size == 1) {
        val types = if (words[0].length > 2) routeTypesOf(words[0]) else emptyList()
        return if (types.isNotEmpty()) types to null else null
    }
    if (words.size != 2) return null
    val (first, second) = words
    val (typeWord, num) = if (first.any(Char::isDigit)) second to first else first to second
    if (!num.any(Char::isDigit)) return null
    val types = routeTypesOf(typeWord)
    return if (types.isNotEmpty()) types to num else null
}

/** «8» - это 8 и 8а, но не 80. */
private fun sameRouteNumber(num: String, query: String): Boolean {
    val value = normalizeSearch(num)
    return value.startsWith(query) && value.drop(query.length).firstOrNull()?.isDigit() != true
}

data class SearchResults(
    val stops: List<Stop>,
    val routes: List<RouteStops>,
    val stations: List<RailStation>,
    val depots: List<Depot>,
) {
    val isEmpty get() = stops.isEmpty() && routes.isEmpty() && stations.isEmpty() && depots.isEmpty()
}

private val STOP_ORDER = listOf(StopKind.Tram, StopKind.Troll, StopKind.TrollBus, StopKind.Bus)
private val RAIL_ORDER = listOf("railway_station", "bus_terminal", "airport")
private val DEPOT_WORDS = mapOf(
    "tram" to "трамвайное депо трамвай",
    "troll" to "троллейбусное депо троллейбус",
    "bus" to "автобусный парк автобус автопарк депо",
)
private val DEPOT_ORDER = listOf("tram", "troll", "bus")

fun search(catalog: Catalog, raw: String): SearchResults {
    val query = normalizeSearch(raw)
    val typed = typedRouteQuery(query)
    val routes = catalog.routeStops.filter { route ->
        val type = route.transport ?: return@filter false
        if (typed != null) type in typed.first && (typed.second == null || sameRouteNumber(route.number, typed.second!!))
        else matches(route.toStation, query) || matches(route.fromStation, query) || matches(route.number, query)
    }.sortedWith(compareBy<RouteStops> { it.transport?.let { t -> listOf(TransportType.Tram, TransportType.Troll, TransportType.Bus).indexOf(t) } ?: 9 }
        .thenComparing({ it.number }, byName).thenComparing({ it.fromStation }, byName))
    val stops = catalog.stops.filter { matches(it.name, query) }
        .sortedWith(compareBy<Stop> { STOP_ORDER.indexOf(stopKindOf(catalog.stopTypes[it.id])) }.thenComparing({ it.name }, byName))
    val stations = catalog.railStations.filter { matches(it.name, query) }
        .sortedWith(compareBy<RailStation> { RAIL_ORDER.indexOf(it.kind).let { i -> if (i < 0) 0 else i } }.thenComparing({ it.name }, byName))
    val depots = catalog.depots.filter { matches("${it.name} ${DEPOT_WORDS[it.type].orEmpty()}", query) }
        .sortedWith(compareBy<Depot> { DEPOT_ORDER.indexOf(it.type) }.thenComparing({ it.name }, byName))
    return SearchResults(stops, routes, stations, depots)
}

/** Примеры для печатающейся подсказки: остановки, маршруты («Автобус 50»), вокзалы, депо вперемешку. */
fun typingExamples(catalog: Catalog): List<String> {
    val word = mapOf(TransportType.Tram to "Трамвай", TransportType.Troll to "Троллейбус", TransportType.Bus to "Автобус")
    val groups = listOf(
        catalog.stops.map { it.name }.distinct().shuffled().take(4),
        catalog.routeStops.mapNotNull { r -> r.transport?.let { "${word[it]} ${r.number}" } }.shuffled().take(4),
        catalog.railStations.map { it.name }.shuffled().take(2),
        catalog.depots.map { it.name }.shuffled().take(1),
    )
    return buildList { for (i in 0 until groups.maxOf { it.size }) for (g in groups) g.getOrNull(i)?.let(::add) }
}

/** Пока справочник не загрузился (SearchBar.tsx сайта, TYPING_EXAMPLES). */
val DEFAULT_TYPING_EXAMPLES = listOf(
    "Театральная площадь", "Галерея Краснодар", "Трамвай 8", "Аэропорт Пашковский",
    "Вокзал Краснодар-1", "Автобус 50", "Трамвайное депо",
)
