package ru.khudob1n.krasnodar.transport.ui.settings

import ru.khudob1n.krasnodar.transport.assets.Tabler

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import ru.khudob1n.krasnodar.transport.platform.rememberFileTransfer
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.khudob1n.krasnodar.transport.settings.Favorites
import ru.khudob1n.krasnodar.transport.settings.LocalFavorites
import ru.khudob1n.krasnodar.transport.ui.components.PillButton
import ru.khudob1n.krasnodar.transport.ui.components.PillGrid
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme

/**
 * Перенос избранного файлом (FavoritesTransfer сайта): тот же izbrannoe-transport-krd.json,
 * так что файл с сайта открывается в приложении и наоборот. Загрузка дополняет избранное.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun FavoritesTransfer() {
    val favorites = LocalFavorites.current
    var status by remember { mutableStateOf<String?>(null) }
    val files = rememberFileTransfer(
        onSaved = { ok -> status = if (ok) "Файл сохранён" else "Не удалось сохранить файл" },
        onOpened = { text ->
            val imported = Favorites.parse(text)
            status = if (imported.isEmpty) {
                "В файле нет избранного"
            } else {
                favorites.update { it.merge(imported) }
                "Загружено: остановок — ${imported.stopIds.size}, маршрутов — ${imported.routeIds.size}"
            }
        },
    )
    val note = AppTheme.type.small.copy(lineHeight = 18.sp)
    Section("Избранное") {
        Text(
            "Избранное хранится только на этом устройстве. Сохраните его в файл, чтобы перенести на другое устройство или на сайт.",
            style = note, color = AppTheme.colors.functional,
        )
        PillGrid {
            button { PillButton("Сохранить в файл", { files.save(Favorites.FILE_NAME, favorites.value.toJson()) }, icon = Tabler.download, enabled = !favorites.value.isEmpty) }
            button { PillButton("Загрузить из файла", { files.open() }, icon = Tabler.upload) }
        }
        status?.let { Text(it, Modifier.semantics { liveRegion = LiveRegionMode.Polite }, style = note, color = AppTheme.colors.functional) }
    }
}
