package ru.khudob1n.krasnodar.transport

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import kotlinx.coroutines.flow.MutableStateFlow

class MainActivity : ComponentActivity() {
    /** Ссылка, с которой открыли приложение (или пришла, когда оно уже открыто). */
    private val link = MutableStateFlow<String?>(null)

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        intent.data?.let { link.value = it.toString() }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // При пересоздании экрана (поворот) ссылку второй раз не открываем.
        if (savedInstanceState == null) link.value = intent?.data?.toString()
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            // Приложение открывается сразу картой; весь интерфейс - общий с iOS (модуль shared).
            val openLink by link.collectAsState()
            App(
                link = openLink,
                onLinkHandled = { link.value = null },
                // Иконки статус-бара - под тему приложения, а не системы.
                onDarkChange = { dark ->
                    val style = if (dark) {
                        SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
                    } else {
                        SystemBarStyle.light(android.graphics.Color.TRANSPARENT, android.graphics.Color.TRANSPARENT)
                    }
                    enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
                },
            )
        }
    }
}
