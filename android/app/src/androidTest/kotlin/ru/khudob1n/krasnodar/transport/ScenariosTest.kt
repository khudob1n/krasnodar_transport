package ru.khudob1n.krasnodar.transport

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import ru.khudob1n.krasnodar.transport.settings.MapPreferencesStore

/**
 * Сценарии пассажира на настоящем приложении и настоящих данных (адрес API - из сборки):
 * карта, поиск остановки, карточка, избранное, настройки, маршрут до адреса.
 * Запуск: ./gradlew :app:connectedDebugAndroidTest -PapiBaseUrl=https://krasnodar-transport.khudob1n.ru
 */
@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
class ScenariosTest {
    // Приветствие первого запуска закрывает карту - в сценариях оно не нужно. Отметку ставим
    // до запуска экрана (правило снаружи цепочки), иначе экран успевает прочитать «не видел».
    private val skipWelcome = object : org.junit.rules.ExternalResource() {
        override fun before() {
            val context = InstrumentationRegistry.getInstrumentation().targetContext
            runBlocking { MapPreferencesStore(context).markWelcomeShown() }
        }
    }

    val rule = createAndroidComposeRule<MainActivity>()

    @get:Rule
    val chain: org.junit.rules.RuleChain = org.junit.rules.RuleChain.outerRule(skipWelcome).around(rule)

    private val timeout = 30_000L

    /** Приложение открывается сразу картой. */
    private fun openMap() {
        rule.waitUntilAtLeastOneExists(hasContentDescription("Поиск остановок, маршрутов и вокзалов"), timeout)
    }

    /** Поиск -> остановка: откроется карточка с расписанием. */
    private fun openStop(query: String, name: String) {
        rule.onNodeWithContentDescription("Поиск остановок, маршрутов и вокзалов").performClick()
        rule.onNode(hasSetTextAction()).performTextInput(query)
        rule.waitUntilAtLeastOneExists(hasText(name), timeout)
        rule.onAllNodesWithText(name).onFirst().performClick()
        rule.waitUntilAtLeastOneExists(hasText("Остановка", substring = true), timeout)
    }

    @Test
    fun карта_остановка_избранное() {
        openMap()
        openStop("мира", "ул.Мира")
        rule.waitUntilAtLeastOneExists(hasText("Расписание"), timeout)
        rule.onNodeWithContentDescription("Сохранить остановку в избранное").performClick()
        rule.waitUntilAtLeastOneExists(hasText("В избранном"), timeout)
        // Убираем обратно, чтобы сценарий можно было повторять.
        rule.onNodeWithContentDescription("Убрать остановку из избранного").performClick()
    }

    @Test
    fun маршрут_найден_и_открывается() {
        openMap()
        rule.onNodeWithContentDescription("Поиск остановок, маршрутов и вокзалов").performClick()
        rule.onNode(hasSetTextAction()).performTextInput("трамвай 4")
        rule.waitUntilAtLeastOneExists(hasText("Трамваи"), timeout)
        rule.onAllNodesWithText("4").onFirst().performClick()
        rule.waitUntilAtLeastOneExists(hasText("В избранное"), timeout)
    }

    @Test
    fun настройки_открываются() {
        openMap()
        rule.onNodeWithContentDescription("Настройки").performClick()
        rule.waitUntilAtLeastOneExists(hasText("Что показывать на карте"), timeout)
        rule.onNodeWithText("Трамваи").assertExists()
    }

    @Test
    fun маршрут_от_остановки_до_адреса() {
        openMap()
        openStop("мира", "ул.Мира")
        rule.onNodeWithText("Отсюда").performClick()
        rule.waitUntilAtLeastOneExists(hasText("Маршрут"), timeout)
        rule.onNodeWithContentDescription("Куда").performClick()
        rule.onNode(hasSetTextAction()).performTextInput("Красная 122")
        rule.waitUntilAtLeastOneExists(hasText("Красная улица, 122"), timeout)
        rule.onNodeWithText("Красная улица, 122").performClick()
        // Варианты - с длительностью и временем прибытия.
        rule.waitUntilAtLeastOneExists(hasText("Время в пути примерное", substring = true), 60_000)
    }
}
