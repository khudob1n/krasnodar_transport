package ru.khudob1n.krasnodar.transport.settings

import androidx.compose.runtime.compositionLocalOf
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.serialization.Serializable
import ru.khudob1n.krasnodar.transport.data.Api
import ru.khudob1n.krasnodar.transport.domain.ArrivalFormat
import kotlin.math.roundToInt

/** Слои карты (MapLayerKey сайта; метро в Краснодаре нет). */
@Serializable
data class MapLayersPrefs(
    val bus: Boolean = true,
    val troll: Boolean = true,
    val tram: Boolean = true,
    val stops: Boolean = true,
    val rail: Boolean = true,
    val depots: Boolean = true,
)

/** Размеры меток - множители 0.6..1.6 с шагом 0.1 (IconSizesProvider сайта); итог = all x свой. */
@Serializable
data class IconSizes(
    val all: Float = 1f,
    val vehicles: Float = 1f,
    val stops: Float = 1f,
    val rail: Float = 1f,
    val airport: Float = 1f,
    val other: Float = 1f,
) {
    val isDefault get() = this == IconSizes()

    companion object {
        const val MIN = 0.6f
        const val MAX = 1.6f
        fun clamp(v: Float) = ((v.coerceIn(MIN, MAX) * 10).roundToInt() / 10f)
    }
}

enum class StartView { Center, Location, Last }
enum class Basemap { Default, Simple }
enum class StopDefaultView { Arrivals, Schedule }

/** Настройки карты (MapPreferencesProvider сайта) - одним объектом, как localStorage сайта. */
@Serializable
data class MapPreferences(
    val layers: MapLayersPrefs = MapLayersPrefs(),
    val lowFloorOnly: Boolean = false,
    val showStale: Boolean = true,
    val labels: Boolean = true,
    val startView: StartView = StartView.Center,
    val reduceMotion: Boolean = false,
    val basemap: Basemap = Basemap.Default,
    val arrivalFormat: ArrivalFormat = ArrivalFormat.Relative,
    val stopDefaultView: StopDefaultView = StopDefaultView.Arrivals,
    val maxTransfers: Int = 2,
    val iconSizes: IconSizes = IconSizes(),
)

@Serializable
data class LastView(val lat: Double, val lng: Double, val zoom: Double)

private val mapPreferences get() = DataStores.get("map_preferences")
private val PREFS = stringPreferencesKey("preferences")
private val LAST_VIEW = stringPreferencesKey("last_view")
private val WELCOME_SHOWN = androidx.datastore.preferences.core.booleanPreferencesKey("welcome_shown")

class MapPreferencesStore {
    val preferences: Flow<MapPreferences> = mapPreferences.data.map { p ->
        // Незнакомая или испорченная запись - настройки по умолчанию (разбор по полям на сайте).
        p[PREFS]?.let { runCatching { Api.json.decodeFromString(MapPreferences.serializer(), it) }.getOrNull() } ?: MapPreferences()
    }

    suspend fun update(transform: (MapPreferences) -> MapPreferences) {
        mapPreferences.edit { p ->
            val current = p[PREFS]?.let { runCatching { Api.json.decodeFromString(MapPreferences.serializer(), it) }.getOrNull() } ?: MapPreferences()
            p[PREFS] = Api.json.encodeToString(MapPreferences.serializer(), transform(current))
        }
    }

    /** Приветствие показывается само, пока его не закрыли хоть раз ('hasVisited' сайта). */
    suspend fun welcomeShown(): Boolean = mapPreferences.data.first()[WELCOME_SHOWN] == true

    suspend fun markWelcomeShown() {
        mapPreferences.edit { it[WELCOME_SHOWN] = true }
    }

    /** «Сбросить всё»: настройки и последнее место карты. */
    suspend fun clear() {
        mapPreferences.edit { it.clear() }
    }

    suspend fun lastView(): LastView? = mapPreferences.data.first()[LAST_VIEW]
        ?.let { runCatching { Api.json.decodeFromString(LastView.serializer(), it) }.getOrNull() }

    suspend fun saveLastView(view: LastView) {
        mapPreferences.edit { it[LAST_VIEW] = Api.json.encodeToString(LastView.serializer(), view) }
    }
}

/** Текущие настройки для карточек (формат времени, вид карточки остановки). */
val LocalMapPreferences = compositionLocalOf { MapPreferences() }
