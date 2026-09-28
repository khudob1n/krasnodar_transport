package ru.khudob1n.krasnodar.transport.platform

import kotlinx.io.buffered
import kotlinx.io.files.Path
import kotlinx.io.files.SystemFileSystem
import kotlinx.io.readString
import kotlinx.io.writeString

/** Файлы в папке данных приложения (kotlinx-io - одинаково на Android и iOS). */
object Files {
    fun path(vararg parts: String): Path = Path(Platform.dataDir, *parts)

    fun exists(path: Path): Boolean = SystemFileSystem.exists(path)

    fun readText(path: Path): String = SystemFileSystem.source(path).buffered().use { it.readString() }

    fun writeText(path: Path, text: String) {
        path.parent?.let { SystemFileSystem.createDirectories(it) }
        SystemFileSystem.sink(path).buffered().use { it.writeString(text) }
    }

    fun list(dir: Path): List<Path> = if (exists(dir)) SystemFileSystem.list(dir).toList() else emptyList()

    fun delete(path: Path) {
        if (!exists(path)) return
        if (SystemFileSystem.metadataOrNull(path)?.isDirectory == true) list(path).forEach(::delete)
        SystemFileSystem.delete(path, mustExist = false)
    }
}
