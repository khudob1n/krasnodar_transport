package ru.khudob1n.krasnodar.transport.settings

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import okio.Path.Companion.toPath
import ru.khudob1n.krasnodar.transport.platform.Platform

/**
 * Хранилища настроек (DataStore). Файл - там же, где его держал preferencesDataStore на
 * Android (files/datastore/<имя>.preferences_pb), поэтому после обновления настройки на месте.
 */
internal object DataStores {
    private val stores = HashMap<String, DataStore<Preferences>>()

    fun get(name: String): DataStore<Preferences> = stores.getOrPut(name) {
        PreferenceDataStoreFactory.createWithPath(produceFile = { "${Platform.dataDir}/datastore/$name.preferences_pb".toPath() })
    }
}
