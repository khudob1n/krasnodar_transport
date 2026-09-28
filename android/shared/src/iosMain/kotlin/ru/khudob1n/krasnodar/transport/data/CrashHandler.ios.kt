package ru.khudob1n.krasnodar.transport.data

import kotlin.experimental.ExperimentalNativeApi

@OptIn(ExperimentalNativeApi::class)
actual fun installCrashHandler(onCrash: (thread: String?, stack: String) -> Unit) {
    val previous = getUnhandledExceptionHook()
    setUnhandledExceptionHook { error ->
        onCrash(null, error.stackTraceToString())
        previous?.invoke(error)
    }
}
