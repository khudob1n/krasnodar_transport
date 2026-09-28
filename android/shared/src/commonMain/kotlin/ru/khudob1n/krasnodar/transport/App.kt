package ru.khudob1n.krasnodar.transport

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import ru.khudob1n.krasnodar.transport.data.Api
import ru.khudob1n.krasnodar.transport.data.CrashReporter
import ru.khudob1n.krasnodar.transport.data.TransportRepository
import ru.khudob1n.krasnodar.transport.map.MapScreen
import ru.khudob1n.krasnodar.transport.platform.AppConfig
import ru.khudob1n.krasnodar.transport.settings.FavoritesStore
import ru.khudob1n.krasnodar.transport.settings.MapPreferencesStore
import ru.khudob1n.krasnodar.transport.settings.SearchHistoryStore
import ru.khudob1n.krasnodar.transport.settings.ThemeStore
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme
import ru.khudob1n.krasnodar.transport.ui.theme.ThemePreference
import ru.khudob1n.krasnodar.transport.ui.theme.TransportTheme

/** Сервисы приложения - одни на процесс (на Android их раньше держал TransportApplication). */
object AppGraph {
    val api by lazy { Api(AppConfig.apiBaseUrl) }
    val repository by lazy { TransportRepository(api) }

    /** Настройки карты - одни на приложение: их читают экран карты и мини-карта настроек. */
    val mapPreferences by lazy { MapPreferencesStore() }
    val favorites by lazy { FavoritesStore() }
    val theme by lazy { ThemeStore() }
    val history by lazy { SearchHistoryStore() }

    private var started = false

    /**
     * Запуск: первым делом - отчёты о сбоях (чтобы поймать и падение при запуске), потом
     * справочник из кэша и его обновление. [collectExtra] - то, что умеет только платформа (ANR).
     */
    fun start(collectExtra: suspend CrashReporter.() -> Unit = {}) {
        if (started) return
        started = true
        CrashReporter(api).install(collectExtra)
        repository.start()
    }
}

/**
 * Всё приложение - одна карта (MapScreen) в теме пользователя. [link] - ссылка «Поделиться», с
 * которой открыли приложение; [onDarkChange] - платформе перекрасить системные панели.
 */
@Composable
fun App(link: String?, onLinkHandled: () -> Unit, onDarkChange: (Boolean) -> Unit = {}) {
    val themeStore = AppGraph.theme
    // Тему читаем до первого кадра (файл в пару десятков байт): иначе на холодном старте
    // мелькала бы светлая тема и карта перезагружала стиль.
    val initialTheme = remember { runBlocking { themeStore.theme.first() } }
    val preference by themeStore.theme.collectAsState(initial = initialTheme)
    val scope = rememberCoroutineScope()
    TransportTheme(preference) {
        val dark = AppTheme.colors.isDark
        LaunchedEffect(dark) { onDarkChange(dark) }
        MapScreen(
            link = link,
            onLinkHandled = onLinkHandled,
            theme = preference,
            onThemeChange = { scope.launch { themeStore.set(it) } },
            // Переключатель темы - как на сайте: из текущей в противоположную.
            onToggleTheme = { scope.launch { themeStore.set(if (dark) ThemePreference.Light else ThemePreference.Dark) } },
            onResetAll = { themeStore.clear() },
        )
    }
}
