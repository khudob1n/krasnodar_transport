package ru.khudob1n.krasnodar.transport

import android.app.Application
import org.maplibre.android.MapLibre
import ru.khudob1n.krasnodar.transport.data.Api
import ru.khudob1n.krasnodar.transport.data.CrashReporter
import ru.khudob1n.krasnodar.transport.data.TransportRepository
import ru.khudob1n.krasnodar.transport.settings.FavoritesStore
import ru.khudob1n.krasnodar.transport.settings.MapPreferencesStore

class TransportApplication : Application() {
    lateinit var repository: TransportRepository
        private set

    /** Настройки карты - одни на приложение: их читают экран карты и мини-карта настроек. */
    val mapPreferences by lazy { MapPreferencesStore(this) }
    val favorites by lazy { FavoritesStore(this) }

    override fun onCreate() {
        super.onCreate()
        val api = Api(BuildConfig.API_BASE_URL)
        // Первым делом - чтобы поймать и падение при запуске.
        CrashReporter(this, api).install()
        // Тайлы OpenFreeMap без ключа: MapLibre нужен только контекст.
        MapLibre.getInstance(this)
        repository = TransportRepository(this, api).also { it.start() }
    }
}
