package ru.khudob1n.krasnodar.transport.settings

import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import ru.khudob1n.krasnodar.transport.ui.theme.ThemePreference

private val preferences get() = DataStores.get("preferences")
private val THEME = stringPreferencesKey("theme")

/** Выбор темы - как localStorage 'theme' на сайте (components/ThemeProvider.tsx). */
class ThemeStore {
    val theme: Flow<ThemePreference> = preferences.data.map { prefs ->
        prefs[THEME]?.let { runCatching { ThemePreference.valueOf(it) }.getOrNull() } ?: ThemePreference.System
    }

    suspend fun clear() {
        preferences.edit { it.remove(THEME) }
    }

    suspend fun set(preference: ThemePreference) {
        preferences.edit { it[THEME] = preference.name }
    }
}
