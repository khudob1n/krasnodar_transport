package ru.khudob1n.krasnodar.transport.data

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.IO
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import ru.khudob1n.krasnodar.transport.platform.AppConfig
import ru.khudob1n.krasnodar.transport.platform.Files
import ru.khudob1n.krasnodar.transport.platform.Platform
import kotlin.time.Clock
import kotlin.time.Instant

/** Отчёт о сбое - то же, что принимает сервер (admin/api/src/routes/crashReports.js). */
@Serializable
data class CrashReport(
    val kind: String,
    val happenedAt: String,
    val appVersion: String,
    /** Версия ОС: «Android 17» или «iOS 27.0» (поле называется так со времён только Android). */
    val androidVersion: String,
    val device: String,
    val thread: String? = null,
    val stack: String,
)

/** Перехват падений - у каждой платформы свой (Android: обработчик потока, iOS: хук Kotlin/Native). */
expect fun installCrashHandler(onCrash: (thread: String?, stack: String) -> Unit)

/**
 * Отчёты о падениях и зависаниях. Падение ловится перехватчиком и сохраняется в файл (сеть в
 * этот момент уже не успеть); всё уходит на сервер при следующем запуске. Только release: в debug
 * падения и так видно. Персональных данных нет: стек, версии и модель телефона.
 */
class CrashReporter(private val api: Api) {
    fun install(collectExtra: suspend CrashReporter.() -> Unit = {}) {
        if (AppConfig.isDebug) return
        installCrashHandler { thread, stack -> runCatching { save(report("crash", Clock.System.now(), thread, stack)) } }
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            runCatching { collectExtra() }
            sendPending()
        }
    }

    fun report(kind: String, at: Instant, thread: String?, stack: String) = CrashReport(
        kind = kind,
        happenedAt = at.toString(),
        appVersion = "${AppConfig.versionName} (${AppConfig.versionCode})",
        androidVersion = Platform.osVersion,
        device = Platform.device,
        thread = thread,
        stack = stack.take(16_000),
    )

    fun save(report: CrashReport) {
        Files.writeText(Files.path("crashes", "${Clock.System.now().toEpochMilliseconds()}.json"), Api.json.encodeToString(CrashReport.serializer(), report))
    }

    /** Сохранённые отчёты - на сервер; не ушли (нет сети) - попробуем при следующем запуске. */
    private suspend fun sendPending() {
        val dir = Files.path("crashes")
        Files.list(dir).sortedBy { it.name }.take(10).forEach { file ->
            val report = runCatching { Api.json.decodeFromString(CrashReport.serializer(), Files.readText(file)) }.getOrNull()
            if (report == null) { Files.delete(file); return@forEach }
            if (runCatching { api.sendCrashReport(report) }.isSuccess) Files.delete(file)
        }
        // Больше 20 неотправленных - старые не нужны.
        Files.list(dir).sortedByDescending { it.name }.drop(20).forEach(Files::delete)
    }
}
