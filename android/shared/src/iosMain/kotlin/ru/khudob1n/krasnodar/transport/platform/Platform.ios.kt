package ru.khudob1n.krasnodar.transport.platform

import kotlinx.cinterop.ExperimentalForeignApi
import platform.Foundation.NSApplicationSupportDirectory
import platform.Foundation.NSFileManager
import platform.Foundation.NSSearchPathForDirectoriesInDomains
import platform.Foundation.NSURL
import platform.Foundation.setValue
import platform.Foundation.NSUserDomainMask
import platform.UIKit.UIActivityViewController
import platform.UIKit.UIApplication
import platform.UIKit.UIDevice
import platform.UIKit.UIViewController
import platform.UIKit.UIWindow
import platform.UIKit.UIWindowScene

actual object Platform {
    @OptIn(ExperimentalForeignApi::class)
    actual val dataDir: String by lazy {
        val base = NSSearchPathForDirectoriesInDomains(NSApplicationSupportDirectory, NSUserDomainMask, true).first() as String
        NSFileManager.defaultManager.createDirectoryAtPath(base, withIntermediateDirectories = true, attributes = null, error = null)
        base
    }

    actual val osVersion: String get() = "iOS ${UIDevice.currentDevice.systemVersion}"

    actual val device: String get() = UIDevice.currentDevice.model

    actual fun log(tag: String, message: String, error: Throwable?) {
        println("$tag: $message${error?.let { " - $it" } ?: ""}")
    }

    actual fun share(text: String, subject: String) {
        val controller = UIActivityViewController(activityItems = listOf(text), applicationActivities = null)
        controller.setValue(subject, forKey = "subject")
        topController()?.presentViewController(controller, animated = true, completion = null)
    }

    actual fun openUrl(url: String) {
        val nsUrl = NSURL.URLWithString(url) ?: return
        UIApplication.sharedApplication.openURL(nsUrl, options = emptyMap<Any?, Any>(), completionHandler = null)
    }

    private fun topController(): UIViewController? {
        val window = UIApplication.sharedApplication.connectedScenes
            .filterIsInstance<UIWindowScene>()
            .flatMap { it.windows.filterIsInstance<UIWindow>() }
            .firstOrNull { it.isKeyWindow() }
        var top = window?.rootViewController
        while (top?.presentedViewController != null) top = top.presentedViewController
        return top
    }
}
