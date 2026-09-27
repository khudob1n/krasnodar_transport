package ru.khudob1n.krasnodar.transport.settings

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.longOrNull
import ru.khudob1n.krasnodar.transport.data.Api

/**
 * Избранное - в том же виде, что у сайта (components/FavoritesProvider.tsx) и в его файле
 * izbrannoe-transport-krd.json: id остановок строками, id маршрутов числами и свои названия
 * остановок («Дом», «Работа»). Храним только id - названия и рейсы берутся из справочника.
 */
@Serializable
data class Favorites(
    val stopIds: List<String> = emptyList(),
    val routeIds: List<Long> = emptyList(),
    val stopNames: Map<String, String> = emptyMap(),
) {
    val isEmpty get() = stopIds.isEmpty() && routeIds.isEmpty()

    fun hasStop(id: Long) = id.toString() in stopIds
    fun hasRoute(id: Long) = id in routeIds

    /** Убрали остановку - своё название ей больше не нужно. */
    fun toggleStop(id: Long): Favorites {
        val key = id.toString()
        return if (key in stopIds) copy(stopIds = stopIds - key, stopNames = stopNames - key) else copy(stopIds = stopIds + key)
    }

    fun toggleRoute(id: Long) = copy(routeIds = if (id in routeIds) routeIds - id else routeIds + id)

    /** Пустое название возвращает официальное. */
    fun rename(id: Long, name: String): Favorites {
        val key = id.toString()
        val trimmed = name.trim().take(STOP_NAME_MAX_LENGTH)
        return copy(stopNames = if (trimmed.isEmpty()) stopNames - key else stopNames + (key to trimmed))
    }

    /** Импорт из файла дополняет, а не заменяет; свои названия с этого устройства важнее. */
    fun merge(imported: Favorites) = Favorites(
        stopIds = (stopIds + imported.stopIds).distinct(),
        routeIds = (routeIds + imported.routeIds).distinct(),
        stopNames = imported.stopNames + stopNames,
    )

    fun toJson(): String = pretty.encodeToString(serializer(), this)

    companion object {
        const val STOP_NAME_MAX_LENGTH = 40
        const val FILE_NAME = "izbrannoe-transport-krd.json"
        private val pretty = kotlinx.serialization.json.Json { prettyPrint = true }

        /** Разбор как parseFavorites сайта: чужие и битые поля пропускаются, а не роняют разбор. */
        fun parse(raw: String?): Favorites {
            val root = runCatching { Api.json.parseToJsonElement(raw.orEmpty()) as? JsonObject }.getOrNull() ?: return Favorites()
            val stops = (root["stopIds"] as? JsonArray).orEmpty().mapNotNull { (it as? JsonPrimitive)?.takeIf { p -> p.isString }?.content }
            val routes = (root["routeIds"] as? JsonArray).orEmpty().mapNotNull { (it as? JsonPrimitive)?.takeIf { p -> !p.isString }?.longOrNull }
            val names = (root["stopNames"] as? JsonObject).orEmpty().mapNotNull { (id, value) ->
                val name = (value as? JsonPrimitive)?.takeIf { it.isString }?.contentOrNull?.trim()?.take(STOP_NAME_MAX_LENGTH)
                if (name.isNullOrEmpty()) null else id to name
            }.toMap()
            return Favorites(stops, routes, names)
        }
    }
}

private val Context.favorites by preferencesDataStore("favorites")
private val KEY = stringPreferencesKey("favorites")

class FavoritesStore(private val context: Context) {
    val favorites: Flow<Favorites> = context.favorites.data.map { Favorites.parse(it[KEY]) }

    suspend fun update(transform: (Favorites) -> Favorites) {
        context.favorites.edit { it[KEY] = transform(Favorites.parse(it[KEY])).toJson() }
    }

    suspend fun clear() {
        context.favorites.edit { it.clear() }
    }
}

/** Избранное и его изменение - для карточек (кнопка «В избранное») и панели избранного. */
class FavoritesState(val value: Favorites, val update: ((Favorites) -> Favorites) -> Unit)

val LocalFavorites = androidx.compose.runtime.compositionLocalOf { FavoritesState(Favorites()) {} }
