package ru.khudob1n.krasnodar.transport

import android.content.Intent
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.BySelector
import androidx.test.uiautomator.StaleObjectException
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.UiObject2
import androidx.test.uiautomator.Until
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertNotNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import ru.khudob1n.krasnodar.transport.platform.Platform

/**
 * Сценарии пользователя на живых данных - как их проходит человек: нажатия по экрану и поиск
 * элементов по подписям TalkBack (UiAutomator). Тестовая обвязка Compose здесь не подходит: она
 * возобновляет корутины в своём потоке, а карта (maplibre-compose) принимает вызовы только из
 * главного.
 *
 * Запуск: ./gradlew :app:connectedDebugAndroidTest -PapiBaseUrl=https://krasnodar-transport.khudob1n.ru
 */
@RunWith(AndroidJUnit4::class)
class ScenariosTest {
    private val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
    private val timeout = 30_000L

    @Before
    fun start() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        // Приветствие первого запуска закрывает карту - в сценариях оно не нужно.
        Platform.init(context)
        runBlocking { AppGraph.mapPreferences.markWelcomeShown() }
        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)!!
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK or Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        // Первый запуск отладочной сборки после установки долгий: Android проверяет код библиотек.
        waitFor(By.desc("Поиск остановок, маршрутов и вокзалов"), 90_000)
    }

    /** Ждём элемент и даём анимации (выезд шторки, проявление) закончиться - иначе нажатие мимо. */
    private fun waitFor(selector: BySelector, ms: Long = timeout): UiObject2 {
        assertNotNull("Нет на экране: $selector", device.wait(Until.findObject(selector), ms))
        Thread.sleep(600)
        return device.findObject(selector).also { assertNotNull("Пропал с экрана: $selector", it) }
    }

    /** Compose перестраивает элементы (печатающаяся подсказка, анимации) - найденный мог устареть. */
    private fun <T> retry(block: () -> T): T {
        repeat(5) {
            try { return block() } catch (_: StaleObjectException) { Thread.sleep(300) }
        }
        return block()
    }

    private fun click(selector: BySelector) = retry { waitFor(selector).click() }

    private fun type(text: String) = retry { waitFor(By.clazz("android.widget.EditText")).text = text }

    /** Поиск -> остановка: откроется карточка с расписанием. */
    private fun openStop(query: String, name: String) {
        click(By.desc("Поиск остановок, маршрутов и вокзалов"))
        type(query)
        click(By.text(name))
        waitFor(By.textContains("Остановка"))
    }

    @Test
    fun карта_остановка_избранное() {
        openStop("мира", "ул.Мира")
        waitFor(By.text("Расписание"))
        click(By.desc("Сохранить остановку в избранное"))
        waitFor(By.text("В избранном"))
        // Убираем обратно, чтобы сценарий можно было повторять.
        click(By.desc("Убрать остановку из избранного"))
    }

    @Test
    fun маршрут_найден_и_открывается() {
        click(By.desc("Поиск остановок, маршрутов и вокзалов"))
        type("трамвай 4")
        waitFor(By.text("Трамваи"))
        click(By.text("4"))
        waitFor(By.text("В избранное"))
    }

    @Test
    fun настройки_открываются() {
        click(By.desc("Настройки"))
        waitFor(By.text("Что показывать на карте"))
        waitFor(By.text("Трамваи"))
    }

    @Test
    fun маршрут_от_остановки_до_адреса() {
        openStop("мира", "ул.Мира")
        click(By.text("Отсюда"))
        waitFor(By.text("Маршрут"))
        click(By.desc("Куда"))
        type("Красная 122")
        click(By.text("Красная улица, 122"))
        // Нашёлся вариант - у него кнопка навигатора (UiAutomator видит только то, что на экране).
        waitFor(By.text("Поехали"), 60_000)
    }
}
