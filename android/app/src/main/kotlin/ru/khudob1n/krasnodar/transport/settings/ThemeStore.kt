package ru.khudob1n.krasnodar.transport.settings

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import ru.khudob1n.krasnodar.transport.ui.theme.ThemePreference

private val Context.preferences by preferencesDataStore("preferences")
private val THEME = stringPreferencesKey("theme")

/** Выбор темы - как localStorage 'theme' на сайте (components/ThemeProvider.tsx). */
class ThemeStore(private val context: Context) {
    val theme: Flow<ThemePreference> = context.preferences.data.map { prefs ->
        prefs[THEME]?.let { runCatching { ThemePreference.valueOf(it) }.getOrNull() } ?: ThemePreference.System
    }

    suspend fun clear() {
        context.preferences.edit { it.remove(THEME) }
    }

    suspend fun set(preference: ThemePreference) {
        context.preferences.edit { it[THEME] = preference.name }
    }
}
