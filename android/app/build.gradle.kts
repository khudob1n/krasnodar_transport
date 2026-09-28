
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// Версия - в version.properties (меняет release.sh), чтобы номер жил в одном месте.
val versionProps = Properties().apply { rootProject.file("version.properties").inputStream().use(::load) }

// Ключ подписи релизов - вне проекта: ~/.android/keys/krasnodar-transport/keystore.properties
// (storeFile, storePassword, keyAlias, keyPassword) или файл из -PkeystoreProperties=...
val keystoreFile = providers.gradleProperty("keystoreProperties").orNull?.let(::file)
    ?: file("${System.getProperty("user.home")}/.android/keys/krasnodar-transport/keystore.properties")
val keystoreProps = keystoreFile.takeIf { it.exists() }?.let { f -> Properties().apply { f.inputStream().use(::load) } }

android {
    namespace = "ru.khudob1n.krasnodar.transport"
    compileSdk = 37

    defaultConfig {
        applicationId = "ru.khudob1n.krasnodar.transport"
        minSdk = 26
        targetSdk = 37
        versionCode = versionProps.getProperty("versionCode").toInt()
        versionName = versionProps.getProperty("versionName")
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    // Адрес сайта, с которого приложение берёт всё API (docs/app-api.md). Переопределяется
    // -PapiBaseUrl=... при сборке. Debug по умолчанию - локальный сайт через
    // `adb reverse tcp:3300 tcp:3300`: на Android 17 приложению без отдельного разрешения
    // закрыт доступ в локальную сеть, в том числе к 10.0.2.2, а loopback - нет. Release - прод.
    val apiBaseUrl = providers.gradleProperty("apiBaseUrl").map { it.trimEnd('/') }
    signingConfigs {
        if (keystoreProps != null) create("release") {
            storeFile = file(keystoreProps.getProperty("storeFile"))
            storePassword = keystoreProps.getProperty("storePassword")
            keyAlias = keystoreProps.getProperty("keyAlias")
            keyPassword = keystoreProps.getProperty("keyPassword")
        }
    }
    // Ссылки «Поделиться» всегда ведут на прод: их открывают другие люди.
    defaultConfig.buildConfigField("String", "SHARE_BASE_URL", "\"https://krasnodar-transport.khudob1n.ru\"")
    buildTypes {
        debug {
            buildConfigField("String", "API_BASE_URL", "\"${apiBaseUrl.getOrElse("http://127.0.0.1:3300")}\"")
        }
        release {
            buildConfigField("String", "API_BASE_URL", "\"${apiBaseUrl.getOrElse("https://krasnodar-transport.khudob1n.ru")}\"")
            isMinifyEnabled = true
            isShrinkResources = true
            // Нет ключа - релиз собирается неподписанным (его не установить), release.sh это проверяет.
            signingConfig = signingConfigs.findByName("release")
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
}

dependencies {
    implementation(libs.androidx.core)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.foundation)
    implementation(libs.compose.material3)
    implementation(libs.compose.ui.tooling.preview)
    debugImplementation(libs.compose.ui.tooling)
    // Весь код приложения - общий с iOS: данные, логика, экраны, карта (maplibre-compose).
    implementation(project(":shared"))
    androidTestImplementation(libs.androidx.test.uiautomator)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.ext.junit)
    // Espresso 3.5 из ui-test падает на Android 17 (нет InputManager.getInstance) - нужна свежая.
    androidTestImplementation(libs.androidx.test.espresso)
    debugImplementation(libs.compose.ui.test.manifest)
}
