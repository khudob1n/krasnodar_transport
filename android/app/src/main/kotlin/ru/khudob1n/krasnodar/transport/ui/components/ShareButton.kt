package ru.khudob1n.krasnodar.transport.ui.components

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import ru.khudob1n.krasnodar.transport.BuildConfig
import ru.khudob1n.krasnodar.transport.R

/**
 * Ссылки «Поделиться» - те же, что у сайта (mapShareUrl): https://<сайт>/map?stop=…,
 * ?vehicle=…, ?from=…&to=…. У кого есть приложение - откроется оно (App Links, файл
 * .well-known/assetlinks.json на сайте), у кого нет - сайт на том же объекте.
 */
object ShareLinks {
    fun stop(id: Long): String = map("stop" to id.toString())
    fun vehicle(deviceCode: String): String = map("vehicle" to deviceCode)

    /** Маршрут: точка - id остановки или «широта,долгота» с подписью в fromName/toName. */
    fun journey(from: String, to: String, fromName: String?, toName: String?): String =
        map("from" to from, "to" to to, "fromName" to fromName, "toName" to toName)

    private fun map(vararg params: Pair<String, String?>): String {
        val builder = Uri.parse(BuildConfig.SHARE_BASE_URL).buildUpon().appendPath("map")
        params.forEach { (key, value) -> if (value != null) builder.appendQueryParameter(key, value) }
        return builder.build().toString()
    }
}

/** Системное меню «Поделиться» со ссылкой. */
fun shareLink(context: Context, url: String, title: String) {
    val send = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, url)
        putExtra(Intent.EXTRA_SUBJECT, title)
        putExtra(Intent.EXTRA_TITLE, title)
    }
    context.startActivity(Intent.createChooser(send, title))
}

/** «Поделиться» (ShareButton сайта): кнопка-таблетка, открывает системное меню. */
@Composable
fun ShareButton(url: String, title: String) {
    val context = LocalContext.current
    PillButton("Поделиться", { shareLink(context, url, title) }, icon = R.drawable.tabler_share_2)
}
