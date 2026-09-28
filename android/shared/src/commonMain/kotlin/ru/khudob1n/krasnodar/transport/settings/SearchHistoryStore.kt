package ru.khudob1n.krasnodar.transport.settings

import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import ru.khudob1n.krasnodar.transport.data.Api

private val searchHistory get() = DataStores.get("search_history")
private val KEY = stringPreferencesKey("entries")
private const val MAX_ENTRIES = 8

/** Запись истории - вид и id, строка собирается из свежих данных (services/searchHistory.ts сайта). */
@Serializable
data class SearchHistoryEntry(val kind: String, val id: String)

class SearchHistoryStore {
    private val serializer = ListSerializer(SearchHistoryEntry.serializer())

    val entries: Flow<List<SearchHistoryEntry>> = searchHistory.data.map { prefs ->
        prefs[KEY]?.let { runCatching { Api.json.decodeFromString(serializer, it) }.getOrNull() }.orEmpty()
    }

    suspend fun clear() {
        searchHistory.edit { it.clear() }
    }

    /** Открытый результат встаёт первым, повтор убирается, хвост обрезается до 8. */
    suspend fun remember(entry: SearchHistoryEntry) {
        searchHistory.edit { prefs ->
            val current = prefs[KEY]?.let { runCatching { Api.json.decodeFromString(serializer, it) }.getOrNull() }.orEmpty()
            prefs[KEY] = Api.json.encodeToString(serializer, (listOf(entry) + current.filter { it != entry }).take(MAX_ENTRIES))
        }
    }
}
