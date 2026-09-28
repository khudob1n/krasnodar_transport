package ru.khudob1n.krasnodar.transport.platform

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import kotlinx.cinterop.ExperimentalForeignApi
import platform.Foundation.NSString
import platform.Foundation.NSTemporaryDirectory
import platform.Foundation.NSURL
import platform.Foundation.NSUTF8StringEncoding
import platform.Foundation.stringWithContentsOfURL
import platform.Foundation.writeToURL
import platform.UIKit.UIApplication
import platform.UIKit.UIDocumentPickerDelegateProtocol
import platform.UIKit.UIDocumentPickerViewController
import platform.UIKit.UIViewController
import platform.UIKit.UIWindow
import platform.UIKit.UIWindowScene
import platform.UniformTypeIdentifiers.UTTypeJSON
import platform.UniformTypeIdentifiers.UTTypePlainText
import platform.darwin.NSObject

@OptIn(ExperimentalForeignApi::class)
@Composable
actual fun rememberFileTransfer(onSaved: (Boolean) -> Unit, onOpened: (String?) -> Unit): FileTransfer {
    val saved = rememberUpdatedState(onSaved)
    val opened = rememberUpdatedState(onOpened)
    return remember {
        object : FileTransfer {
            // Делегат держим, пока окно открыто: UIKit хранит на него слабую ссылку.
            private var delegate: NSObject? = null

            override fun save(fileName: String, text: String) {
                val url = NSURL.fileURLWithPath(NSTemporaryDirectory() + fileName)
                @Suppress("CAST_NEVER_SUCCEEDS")
                val ok = (text as NSString).writeToURL(url, atomically = true, encoding = NSUTF8StringEncoding, error = null)
                if (!ok) { saved.value(false); return }
                val picker = UIDocumentPickerViewController(forExportingURLs = listOf(url), asCopy = true)
                delegate = object : NSObject(), UIDocumentPickerDelegateProtocol {
                    override fun documentPicker(controller: UIDocumentPickerViewController, didPickDocumentsAtURLs: List<*>) { saved.value(true) }
                    override fun documentPickerWasCancelled(controller: UIDocumentPickerViewController) = Unit
                }.also { picker.delegate = it }
                present(picker)
            }

            override fun open() {
                val picker = UIDocumentPickerViewController(forOpeningContentTypes = listOf(UTTypeJSON, UTTypePlainText), asCopy = true)
                delegate = object : NSObject(), UIDocumentPickerDelegateProtocol {
                    override fun documentPicker(controller: UIDocumentPickerViewController, didPickDocumentsAtURLs: List<*>) {
                        val url = didPickDocumentsAtURLs.firstOrNull() as? NSURL ?: return
                        opened.value(NSString.stringWithContentsOfURL(url, NSUTF8StringEncoding, null))
                    }
                    override fun documentPickerWasCancelled(controller: UIDocumentPickerViewController) = Unit
                }.also { picker.delegate = it }
                present(picker)
            }
        }
    }
}

private fun present(controller: UIViewController) {
    val window = UIApplication.sharedApplication.connectedScenes
        .filterIsInstance<UIWindowScene>()
        .flatMap { it.windows.filterIsInstance<UIWindow>() }
        .firstOrNull { it.isKeyWindow() }
    var top = window?.rootViewController
    while (top?.presentedViewController != null) top = top.presentedViewController
    top?.presentViewController(controller, animated = true, completion = null)
}
