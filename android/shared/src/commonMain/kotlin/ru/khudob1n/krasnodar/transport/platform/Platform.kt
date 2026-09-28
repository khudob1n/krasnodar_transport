package ru.khudob1n.krasnodar.transport.platform

/** Настройки сборки - задаёт приложение платформы при запуске (MainActivity, MainViewController). */
object AppConfig {
    /** Адрес API сайта: в debug-сборке Android - локальный сайт, иначе прод. */
    var apiBaseUrl: String = "https://krasnodar-transport.khudob1n.ru"

    /** Ссылки «Поделиться» всегда ведут на прод: их открывают другие люди. */
    const val SHARE_BASE_URL: String = "https://krasnodar-transport.khudob1n.ru"

    var versionName: String = ""
    var versionCode: Int = 0
    var isDebug: Boolean = false
}

/** То, что устроено по-разному на Android и iOS. */
expect object Platform {
    /** Папка данных приложения (кэш справочника, отчёты о сбоях, настройки). */
    val dataDir: String

    /** «Android 17», «iOS 27.0». */
    val osVersion: String

    /** Модель устройства - для отчётов о сбоях. */
    val device: String

    fun log(tag: String, message: String, error: Throwable? = null)

    /** Системное окно «Поделиться» со ссылкой. */
    fun share(text: String, subject: String)

    /** Открыть ссылку в браузере или другом приложении. */
    fun openUrl(url: String)
}
