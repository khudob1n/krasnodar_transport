package ru.khudob1n.krasnodar.transport.ui.search

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

private const val TYPE_MS = 130L
private const val ERASE_MS = 65L
private const val HOLD_MS = 2400L
private const val GAP_MS = 800L
private const val BLINK_MS = 530L

/**
 * Подсказка, которая «сама печатается» (hooks/useTypingPlaceholder.ts сайта): фраза набирается
 * по букве, стоит, стирается, за ней следующая; в паузах мигает каретка. null - анимации нет.
 */
@Composable
fun rememberTypingPlaceholder(phrases: List<String>, active: Boolean): String? {
    var text by remember { mutableStateOf<String?>(null) }
    var caret by remember { mutableStateOf(true) }
    LaunchedEffect(phrases, active) {
        if (!active || phrases.isEmpty()) { text = null; return@LaunchedEffect }
        suspend fun pause(ms: Long) {
            var left = ms
            while (left > 0 && isActive) { delay(minOf(BLINK_MS, left)); left -= BLINK_MS; caret = !caret }
            caret = true
        }
        var index = 0
        text = ""
        pause(GAP_MS)
        while (isActive) {
            val phrase = phrases[index]
            for (length in 1..phrase.length) { text = phrase.take(length); delay(TYPE_MS) }
            pause(HOLD_MS)
            for (length in phrase.length - 1 downTo 0) { text = phrase.take(length); delay(ERASE_MS) }
            index = (index + 1) % phrases.size
            pause(GAP_MS)
        }
    }
    return text?.let { if (caret) "$it|" else it }
}
