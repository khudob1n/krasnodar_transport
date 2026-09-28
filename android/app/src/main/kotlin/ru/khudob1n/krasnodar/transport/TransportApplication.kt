package ru.khudob1n.krasnodar.transport

import android.app.Application
import ru.khudob1n.krasnodar.transport.data.collectAnrs
import ru.khudob1n.krasnodar.transport.platform.AppConfig
import ru.khudob1n.krasnodar.transport.platform.Platform

class TransportApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        Platform.init(this)
        AppConfig.apiBaseUrl = BuildConfig.API_BASE_URL
        AppConfig.versionName = BuildConfig.VERSION_NAME
        AppConfig.versionCode = BuildConfig.VERSION_CODE
        AppConfig.isDebug = BuildConfig.DEBUG
        // Отчёты о сбоях (с зависаниями из истории Android) и справочник - как только процесс поднялся.
        AppGraph.start(collectExtra = { collectAnrs() })
    }
}
