package ru.khudob1n.krasnodar.transport.platform

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext

@Composable
actual fun rememberFileTransfer(onSaved: (Boolean) -> Unit, onOpened: (String?) -> Unit): FileTransfer {
    val context = LocalContext.current
    val pending = remember { arrayOf("") }
    val save = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        onSaved(runCatching { context.contentResolver.openOutputStream(uri, "wt")!!.use { it.write(pending[0].toByteArray()) } }.isSuccess)
    }
    val open = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        onOpened(runCatching { context.contentResolver.openInputStream(uri)!!.use { it.readBytes().decodeToString() } }.getOrNull())
    }
    return remember(save, open) {
        object : FileTransfer {
            override fun save(fileName: String, text: String) {
                pending[0] = text
                save.launch(fileName)
            }

            override fun open() = open.launch(arrayOf("application/json", "application/octet-stream", "text/plain"))
        }
    }
}
