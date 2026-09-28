package ru.khudob1n.krasnodar.transport.ui.components

import ru.khudob1n.krasnodar.transport.assets.Tabler

import androidx.compose.runtime.Composable
import io.ktor.http.URLBuilder
import io.ktor.http.appendPathSegments
import ru.khudob1n.krasnodar.transport.platform.AppConfig
import ru.khudob1n.krasnodar.transport.platform.Platform

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
        val builder = URLBuilder(AppConfig.SHARE_BASE_URL).appendPathSegments("map")
        params.forEach { (key, value) -> if (value != null) builder.parameters.append(key, value) }
        return builder.buildString()
    }
}

/** Системное меню «Поделиться» со ссылкой. */
fun shareLink(url: String, title: String) = Platform.share(url, title)

/** «Поделиться» (ShareButton сайта): кнопка-таблетка, открывает системное меню. */
@Composable
fun ShareButton(url: String, title: String) {
    PillButton("Поделиться", { shareLink(url, title) }, icon = Tabler.share_2)
}
