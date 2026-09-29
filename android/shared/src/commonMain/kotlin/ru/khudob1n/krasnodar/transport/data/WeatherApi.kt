package ru.khudob1n.krasnodar.transport.data

import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.isSuccess
import kotlinx.io.IOException
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlin.math.roundToInt

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

    private val client: HttpClient by lazy { Api.defaultClient() }

    suspend fun fetch(): Weather {
        val res = client.get(URL)
        if (!res.status.isSuccess()) throw IOException("Open-Meteo: ${res.status.value}")
        val current = Api.json.decodeFromString(Response.serializer(), res.bodyAsText()).current
        return Weather(current.temperature.roundToInt(), kindOfCode(current.code), current.isDay == 1)
    }
}

/** Коды погоды WMO -> вид для иконки (kindOf сайта). */
internal fun kindOfCode(code: Int) = when {
    code == 0 -> WeatherKind.Clear
    code <= 2 -> WeatherKind.Partly
    code == 3 -> WeatherKind.Cloudy
    code == 45 || code == 48 -> WeatherKind.Fog
    code in 71..77 || code == 85 || code == 86 -> WeatherKind.Snow
    code >= 95 -> WeatherKind.Storm
    else -> WeatherKind.Rain
}

// ---------------- Подробная погода (карточка по нажатию на плашку, MapWeatherSidebar сайта) ----------------

data class WeatherHour(val time: String, val temperature: Int, val kind: WeatherKind, val isDay: Boolean, val precipitation: Int)

data class WeatherDay(val date: String, val min: Int, val max: Int, val kind: WeatherKind, val precipitation: Int)

data class WeatherDetails(
    val now: Weather,
    val feelsLike: Int,
    /** Ветер, м/с, и откуда дует (градусы). */
    val wind: Int,
    val gusts: Int,
    val windFrom: Double,
    val humidity: Int,
    /** Давление, мм рт. ст. */
    val pressure: Int,
    val sunrise: String,
    val sunset: String,
    /** Подсказка для поездки: осадки скоро, сильный ветер, мороз, жара - или null. */
    val hint: String?,
    val hours: List<WeatherHour>,
    val days: List<WeatherDay>,
)

private val COMPASS = listOf("С", "СВ", "В", "ЮВ", "Ю", "ЮЗ", "З", "СЗ")

/** «СВ» - откуда дует ветер (как в прогнозах). */
fun windName(degrees: Double) = COMPASS[(kotlin.math.round(degrees / 45).toInt() % 8 + 8) % 8]

object WeatherDetailsApi {
    private const val URL = "https://api.open-meteo.com/v1/forecast?latitude=45.0355&longitude=38.9753" +
        "&current=temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m," +
        "wind_direction_10m,wind_gusts_10m,relative_humidity_2m,surface_pressure" +
        "&minutely_15=precipitation&forecast_minutely_15=8" +
        "&hourly=temperature_2m,weather_code,is_day,precipitation_probability&forecast_hours=24" +
        "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset" +
        "&forecast_days=7&wind_speed_unit=ms&timezone=Europe%2FMoscow"

    @Serializable
    private data class Current(
        val time: String,
        @SerialName("temperature_2m") val temperature: Double,
        @SerialName("apparent_temperature") val feelsLike: Double,
        @SerialName("weather_code") val code: Int,
        @SerialName("is_day") val isDay: Int,
        @SerialName("wind_speed_10m") val wind: Double,
        @SerialName("wind_direction_10m") val windFrom: Double,
        @SerialName("wind_gusts_10m") val gusts: Double,
        @SerialName("relative_humidity_2m") val humidity: Double,
        @SerialName("surface_pressure") val pressure: Double,
    )

    @Serializable
    private data class Hourly(
        val time: List<String>,
        @SerialName("temperature_2m") val temperature: List<Double>,
        @SerialName("weather_code") val code: List<Int>,
        @SerialName("is_day") val isDay: List<Int>,
        @SerialName("precipitation_probability") val precipitation: List<Int?>,
    )

    @Serializable
    private data class Daily(
        val time: List<String>,
        @SerialName("weather_code") val code: List<Int>,
        @SerialName("temperature_2m_max") val max: List<Double>,
        @SerialName("temperature_2m_min") val min: List<Double>,
        @SerialName("precipitation_probability_max") val precipitation: List<Int?>,
        val sunrise: List<String>,
        val sunset: List<String>,
    )

    @Serializable
    private data class Minutely(val time: List<String>, val precipitation: List<Double?>)

    @Serializable
    private data class Response(
        val current: Current,
        val hourly: Hourly,
        val daily: Daily,
        @SerialName("minutely_15") val minutely: Minutely,
    )

    private fun hhmm(iso: String) = iso.substring(11, 16)

    private fun minutesOf(iso: String) = iso.substring(11, 13).toInt() * 60 + iso.substring(14, 16).toInt()

    /** Одна, самая важная подсказка: осадки сейчас или в ближайшие 2 часа, ветер, мороз, жара. */
    private fun hintOf(kind: WeatherKind, temperature: Int, feelsLike: Int, gusts: Double, minutely: Minutely, now: String): String? {
        val what = if (temperature <= 0) "снег" else "дождь"
        if (kind == WeatherKind.Storm) return "Сейчас гроза — лучше переждать под крышей."
        if (kind == WeatherKind.Rain || kind == WeatherKind.Snow) return "Сейчас $what — возьмите зонт."
        val index = minutely.precipitation.indexOfFirst { (it ?: 0.0) >= 0.1 }
        if (index >= 0) {
            var minutes = minutesOf(minutely.time[index]) - minutesOf(now)
            if (minutes < 0) minutes += 24 * 60
            return "Через ${maxOf(15, minutes)} мин $what — возьмите зонт."
        }
        if (gusts >= 15) return "Сильный ветер, порывы до ${gusts.roundToInt()} м/с."
        if (feelsLike <= -10) return "Мороз — одевайтесь теплее, ожидание на остановке будет холодным."
        if (feelsLike >= 32) return "Жарко — возьмите воду."
        return null
    }

    suspend fun fetch(): WeatherDetails {
        val res = Api.defaultClient().get(URL)
        if (!res.status.isSuccess()) throw IOException("Open-Meteo: ${res.status.value}")
        val r = Api.json.decodeFromString(Response.serializer(), res.bodyAsText())
        val c = r.current
        val kind = kindOfCode(c.code)
        val temperature = c.temperature.roundToInt()
        val feelsLike = c.feelsLike.roundToInt()
        return WeatherDetails(
            now = Weather(temperature, kind, c.isDay == 1),
            feelsLike = feelsLike,
            wind = c.wind.roundToInt(),
            gusts = c.gusts.roundToInt(),
            windFrom = c.windFrom,
            humidity = c.humidity.roundToInt(),
            pressure = (c.pressure * 0.750062).roundToInt(),
            sunrise = hhmm(r.daily.sunrise.first()),
            sunset = hhmm(r.daily.sunset.first()),
            hint = hintOf(kind, temperature, feelsLike, c.gusts, r.minutely, c.time),
            // Первый час - «сейчас»: как в «сейчас», а не среднее за час.
            hours = r.hourly.time.indices.map { i ->
                WeatherHour(
                    time = hhmm(r.hourly.time[i]),
                    temperature = if (i == 0) temperature else r.hourly.temperature[i].roundToInt(),
                    kind = if (i == 0) kind else kindOfCode(r.hourly.code[i]),
                    isDay = if (i == 0) c.isDay == 1 else r.hourly.isDay[i] == 1,
                    precipitation = r.hourly.precipitation[i] ?: 0,
                )
            },
            days = r.daily.time.indices.map { i ->
                WeatherDay(r.daily.time[i], r.daily.min[i].roundToInt(), r.daily.max[i].roundToInt(), kindOfCode(r.daily.code[i]), r.daily.precipitation[i] ?: 0)
            },
        )
    }
}
