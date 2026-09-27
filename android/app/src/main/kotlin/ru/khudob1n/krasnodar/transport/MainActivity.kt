package ru.khudob1n.krasnodar.transport

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import ru.khudob1n.krasnodar.transport.map.MapScreen
import ru.khudob1n.krasnodar.transport.settings.ThemeStore
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme
import ru.khudob1n.krasnodar.transport.ui.theme.ThemePreference
import ru.khudob1n.krasnodar.transport.ui.theme.TransportTheme

class MainActivity : ComponentActivity() {
    /** Ссылка, с которой открыли приложение (или пришла, когда оно уже открыто). */
    private val link = kotlinx.coroutines.flow.MutableStateFlow<android.net.Uri?>(null)

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        intent.data?.let { link.value = it }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // При пересоздании экрана (поворот) ссылку второй раз не открываем.
        if (savedInstanceState == null) link.value = intent?.data
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val themeStore = ThemeStore(applicationContext)
        // Тему читаем до первого кадра (файл в пару десятков байт): иначе на холодном старте
        // мелькала бы светлая тема и карта перезагружала стиль.
        val initialTheme = runBlocking { themeStore.theme.first() }
        setContent {
            val preference by themeStore.theme.collectAsState(initial = initialTheme)
            val scope = rememberCoroutineScope()
            TransportTheme(preference) {
                val dark = AppTheme.colors.isDark
                // Иконки статус-бара - под тему приложения, а не системы.
                LaunchedEffect(dark) {
                    val style = if (dark) {
                        SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
                    } else {
                        SystemBarStyle.light(android.graphics.Color.TRANSPARENT, android.graphics.Color.TRANSPARENT)
                    }
                    enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
                }
                // Приложение открывается сразу картой; статьи сайта - в настройках.
                val openLink by link.collectAsState()
                MapScreen(
                    link = openLink,
                    onLinkHandled = { link.value = null },
                    theme = preference,
                    onThemeChange = { scope.launch { themeStore.set(it) } },
                    // Переключатель темы - как на сайте: из текущей в противоположную.
                    onToggleTheme = { scope.launch { themeStore.set(if (dark) ThemePreference.Light else ThemePreference.Dark) } },
                    onResetAll = { themeStore.clear() },
                )
            }
        }
    }
}
