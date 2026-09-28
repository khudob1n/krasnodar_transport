package ru.khudob1n.krasnodar.transport.platform

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log

@SuppressLint("StaticFieldLeak") // контекст приложения, не экрана
actual object Platform {
    private lateinit var context: Context

    /** Вызывается из Application.onCreate. */
    fun init(context: Context) {
        this.context = context.applicationContext
    }

    val appContext: Context get() = context

    actual val dataDir: String get() = context.filesDir.absolutePath

    actual val osVersion: String get() = "Android ${Build.VERSION.RELEASE}"

    actual val device: String get() = "${Build.MANUFACTURER} ${Build.MODEL}"

    actual fun log(tag: String, message: String, error: Throwable?) {
        Log.w(tag, message, error)
    }

    actual fun share(text: String, subject: String) {
        val send = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
            putExtra(Intent.EXTRA_SUBJECT, subject)
        }
        context.startActivity(Intent.createChooser(send, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    actual fun openUrl(url: String) {
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}
