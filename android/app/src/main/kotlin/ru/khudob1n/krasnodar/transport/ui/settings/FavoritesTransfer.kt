package ru.khudob1n.krasnodar.transport.ui.settings

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.khudob1n.krasnodar.transport.R
import ru.khudob1n.krasnodar.transport.settings.Favorites
import ru.khudob1n.krasnodar.transport.settings.LocalFavorites
import ru.khudob1n.krasnodar.transport.ui.components.PillButton
import ru.khudob1n.krasnodar.transport.ui.theme.AppTheme

/**
 * Перенос избранного файлом (FavoritesTransfer сайта): тот же izbrannoe-transport-krd.json,
 * так что файл с сайта открывается в приложении и наоборот. Загрузка дополняет избранное.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun FavoritesTransfer() {
    val context = LocalContext.current
    val favorites = LocalFavorites.current
    var status by remember { mutableStateOf<String?>(null) }
    val save = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        status = runCatching {
            context.contentResolver.openOutputStream(uri, "wt")!!.use { it.write(favorites.value.toJson().toByteArray()) }
            "Файл сохранён"
        }.getOrElse { "Не удалось сохранить файл" }
    }
    val open = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        val text = runCatching { context.contentResolver.openInputStream(uri)!!.use { it.readBytes().decodeToString() } }.getOrNull()
        val imported = Favorites.parse(text)
        status = if (imported.isEmpty) {
            "В файле нет избранного"
        } else {
            favorites.update { it.merge(imported) }
            "Загружено: остановок — ${imported.stopIds.size}, маршрутов — ${imported.routeIds.size}"
        }
    }
    val note = AppTheme.type.small.copy(lineHeight = 18.sp)
    Section("Избранное") {
        Text(
            "Избранное хранится только на этом устройстве. Сохраните его в файл, чтобы перенести на другое устройство или на сайт.",
            style = note, color = AppTheme.colors.functional,
        )
        // Две кнопки в строку на телефоне не помещаются - переносятся.
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            PillButton("Сохранить в файл", { save.launch(Favorites.FILE_NAME) }, icon = R.drawable.tabler_download, enabled = !favorites.value.isEmpty)
            PillButton("Загрузить из файла", { open.launch(arrayOf("application/json", "application/octet-stream", "text/plain")) }, icon = R.drawable.tabler_upload)
        }
        status?.let { Text(it, Modifier.semantics { liveRegion = LiveRegionMode.Polite }, style = note, color = AppTheme.colors.functional) }
    }
}
