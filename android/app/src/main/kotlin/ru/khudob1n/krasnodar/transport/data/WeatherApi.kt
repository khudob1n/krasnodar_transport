package ru.khudob1n.krasnodar.transport.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException

enum class WeatherKind(val title: String) {
    Clear("Ясно"), Partly("Переменная облачность"), Cloudy("Пасмурно"), Fog("Туман"), Rain("Дождь"), Snow("Снег"), Storm("Гроза"),
}

data class Weather(val temperature: Int, val kind: WeatherKind, val isDay: Boolean)

/**
 * Погода в Краснодаре - Open-Meteo, как services/weather.ts сайта (открытый, без ключа);
 * обновлять раз в 15 минут - чаще их данные не меняются.
 */
object WeatherApi {
    const val REFRESH_MS = 15 * 60 * 1000L
    private const val URL = "https://api.open-meteo.com/v1/forecast?latitude=45.0355&longitude=38.9753" +
        "&current=temperature_2m,weather_code,is_day&timezone=Europe%2FMoscow"

    @Serializable
    private data class Current(
        @SerialName("temperature_2m") val temperature: Double,
        @SerialName("weather_code") val code: Int,
        @SerialName("is_day") val isDay: Int,
    )

    @Serializable
    private data class Response(val current: Current)

    /** Коды погоды WMO -> вид для иконки (kindOf сайта). */
    private fun kindOf(code: Int) = when {
        code == 0 -> WeatherKind.Clear
        code <= 2 -> WeatherKind.Partly
        code == 3 -> WeatherKind.Cloudy
        code == 45 || code == 48 -> WeatherKind.Fog
        code in 71..77 || code == 85 || code == 86 -> WeatherKind.Snow
        code >= 95 -> WeatherKind.Storm
        else -> WeatherKind.Rain
    }

    suspend fun fetch(client: OkHttpClient = Api.defaultClient()): Weather = withContext(Dispatchers.IO) {
        client.newCall(Request.Builder().url(URL).build()).execute().use { res ->
            if (!res.isSuccessful) throw IOException("Open-Meteo: ${res.code}")
            val current = Api.json.decodeFromString(Response.serializer(), res.body.string()).current
            Weather(Math.round(current.temperature).toInt(), kindOf(current.code), current.isDay == 1)
        }
    }
}
