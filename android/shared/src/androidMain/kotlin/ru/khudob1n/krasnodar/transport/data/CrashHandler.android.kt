package ru.khudob1n.krasnodar.transport.data

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.content.Context
import android.os.Build
import android.util.Log
import ru.khudob1n.krasnodar.transport.platform.Platform
import kotlin.time.Instant

actual fun installCrashHandler(onCrash: (thread: String?, stack: String) -> Unit) {
    val previous = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { thread, error ->
        onCrash(thread.name, Log.getStackTraceString(error))
        previous?.uncaughtException(thread, error)
    }
}

/** Зависания (ANR) с прошлого раза: Android 11+ отдаёт их в истории завершений процесса. */
fun CrashReporter.collectAnrs() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return
    val context = Platform.appContext
    val prefs = context.getSharedPreferences("crash_reporter", Context.MODE_PRIVATE)
    val am = context.getSystemService(ActivityManager::class.java) ?: return
    val last = prefs.getLong("last_anr", 0)
    val anrs = am.getHistoricalProcessExitReasons(null, 0, 5).filter { it.reason == ApplicationExitInfo.REASON_ANR && it.timestamp > last }
    for (info in anrs) {
        val trace = info.traceInputStream?.bufferedReader()?.use { it.readText() } ?: info.description.orEmpty()
        // Из полного дампа - только главный поток: он и завис.
        val main = trace.substringAfter("\"main\"", trace).substringBefore("\n\n").let { if (it.length < trace.length) "\"main\"$it" else it }
        save(report("anr", Instant.fromEpochMilliseconds(info.timestamp), "main", main))
    }
    anrs.maxOfOrNull { it.timestamp }?.let { prefs.edit().putLong("last_anr", it).apply() }
}
