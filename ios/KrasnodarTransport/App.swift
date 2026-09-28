import SwiftUI
import Shared

@main
struct KrasnodarTransportApp: App {
    var body: some Scene {
        WindowGroup {
            ComposeView()
                .ignoresSafeArea()
                // Ссылки сайта (krasnodar-transport.khudob1n.ru/map?stop=…) - открыть объект в приложении.
                .onOpenURL { url in MainViewControllerKt.openLink(url: url.absoluteString) }
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                    if let url = activity.webpageURL { MainViewControllerKt.openLink(url: url.absoluteString) }
                }
        }
    }
}

/// Весь интерфейс - Compose из общего модуля (android/shared), тот же, что на Android.
struct ComposeView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UIViewController {
        MainViewControllerKt.MainViewController()
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}
}
