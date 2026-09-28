package ru.khudob1n.krasnodar.transport.platform

import androidx.compose.runtime.Composable

/** Сохранить текст в файл, выбранный пользователем, и открыть файл (перенос избранного). */
interface FileTransfer {
    fun save(fileName: String, text: String)
    fun open()
}

/** [onOpened] получает текст открытого файла (null - не прочитался); отмена ничего не вызывает. */
@Composable
expect fun rememberFileTransfer(onSaved: (Boolean) -> Unit, onOpened: (String?) -> Unit): FileTransfer
