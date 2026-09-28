package ru.khudob1n.krasnodar.transport

import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.window.ComposeUIViewController
import kotlinx.coroutines.flow.MutableStateFlow
import platform.Foundation.NSBundle
import platform.UIKit.UIViewController
import ru.khudob1n.krasnodar.transport.platform.AppConfig

/** Ссылка, с которой открыли приложение (onOpenURL в SwiftUI). */
private val link = MutableStateFlow<String?>(null)

/** Открыть ссылку сайта в приложении (Universal Links, ContentView.swift). */
fun openLink(url: String) {
    link.value = url
}

/** Точка входа iOS-приложения (iosApp/App.swift): весь интерфейс - общий с Android. */
fun MainViewController(): UIViewController {
    val info = NSBundle.mainBundle.infoDictionary
    AppConfig.versionName = info?.get("CFBundleShortVersionString") as? String ?: ""
    AppConfig.versionCode = (info?.get("CFBundleVersion") as? String)?.toIntOrNull() ?: 0
    AppGraph.start()
    return ComposeUIViewController {
        val openLink by link.collectAsState()
        App(link = openLink, onLinkHandled = { link.value = null })
    }
}
