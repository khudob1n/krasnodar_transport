package ru.khudob1n.krasnodar.transport.data

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.content.Context
import android.os.Build
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import ru.khudob1n.krasnodar.transport.BuildConfig
import java.io.File
import java.time.Instant

/** Отчёт о сбое - то же, что принимает сервер (admin/api/src/routes/crashReports.js). */
@Serializable
data class CrashReport(
    val kind: String,
    val happenedAt: String,
    val appVersion: String,
    val androidVersion: String,
    val device: String,
    val thread: String? = null,
    val stack: String,
)

/**
 * Отчёты о падениях и зависаниях. Падение ловится перехватчиком и сохраняется в файл (сеть в
 * этот момент уже не успеть), зависание (ANR) Android 11+ отдаёт в истории завершений. Всё
 * уходит на сервер при следующем запуске. Только release: в debug падения и так видно.
 * Персональных данных нет: стек, версии и модель телефона.
 */
class CrashReporter(private val context: Context, private val api: Api) {
    private val dir = File(context.filesDir, "crashes").apply { mkdirs() }
    private val prefs = context.getSharedPreferences("crash_reporter", Context.MODE_PRIVATE)

    fun install() {
        if (BuildConfig.DEBUG) return
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            runCatching { save(report("crash", Instant.now(), thread.name, Log.getStackTraceString(error))) }
            previous?.uncaughtException(thread, error)
        }
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            runCatching { collectAnrs() }
            sendPending()
        }
    }

    private fun report(kind: String, at: Instant, thread: String?, stack: String) = CrashReport(
        kind = kind,
        happenedAt = at.toString(),
        appVersion = "${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})",
        androidVersion = Build.VERSION.RELEASE,
        device = "${Build.MANUFACTURER} ${Build.MODEL}",
        thread = thread,
        stack = stack.take(16_000),
    )

    private fun save(report: CrashReport) {
        File(dir, "${System.currentTimeMillis()}.json").writeText(Api.json.encodeToString(CrashReport.serializer(), report))
    }

    /** Зависания с прошлого раза: стек главного потока из системного трейса. */
    private fun collectAnrs() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return
        val am = context.getSystemService(ActivityManager::class.java) ?: return
        val last = prefs.getLong(LAST_ANR, 0)
        val anrs = am.getHistoricalProcessExitReasons(null, 0, 5).filter { it.reason == ApplicationExitInfo.REASON_ANR && it.timestamp > last }
        for (info in anrs) {
            val trace = info.traceInputStream?.bufferedReader()?.use { it.readText() } ?: info.description.orEmpty()
            // Из полного дампа - только главный поток: он и завис.
            val main = trace.substringAfter("\"main\"", trace).substringBefore("\n\n").let { if (it.length < trace.length) "\"main\"$it" else it }
            save(report("anr", Instant.ofEpochMilli(info.timestamp), "main", main))
        }
        anrs.maxOfOrNull { it.timestamp }?.let { prefs.edit().putLong(LAST_ANR, it).apply() }
    }

    /** Сохранённые отчёты - на сервер; не ушли (нет сети) - попробуем при следующем запуске. */
    private suspend fun sendPending() {
        dir.listFiles().orEmpty().sortedBy { it.name }.take(10).forEach { file ->
            val report = runCatching { Api.json.decodeFromString(CrashReport.serializer(), file.readText()) }.getOrNull()
            if (report == null) { file.delete(); return@forEach }
            if (runCatching { api.sendCrashReport(report) }.isSuccess) file.delete()
        }
        // Больше 20 неотправленных - старые не нужны.
        dir.listFiles().orEmpty().sortedByDescending { it.name }.drop(20).forEach { it.delete() }
    }

    private companion object {
        const val LAST_ANR = "last_anr"
    }
}
