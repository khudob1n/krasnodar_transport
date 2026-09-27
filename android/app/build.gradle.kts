import org.gradle.api.DefaultTask
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.tasks.InputDirectory
import org.gradle.api.tasks.OutputDirectory
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction

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

/**
 * Стили карты, глифы подписей и значки - из пассажирского сайта (passenger/client/public), единый
 * источник для сайта и приложения: стили собирает passenger/tools/build-map-style.py. Сайт
 * берёт глифы по относительному пути /fonts/..., MapLibre на Android - из assets, поэтому
 * путь переписывается на asset://.
 */
abstract class SyncWebAssets : DefaultTask() {
    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val webPublic: DirectoryProperty

    /** Пиктограммы транспорта Temaki - их сайт рисует в маркерах машин и остановок (TransportIcon). */
    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val temakiIcons: DirectoryProperty

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @TaskAction
    fun sync() {
        val out = outputDir.get().asFile.apply { deleteRecursively(); mkdirs() }
        val public = webPublic.get().asFile
        for (theme in listOf("light", "dark")) {
            val style = public.resolve("map-style-$theme.json").readText()
                .replace("\"/fonts/{fontstack}/{range}.pbf\"", "\"asset://fonts/{fontstack}/{range}.pbf\"")
            out.resolve("map-style-$theme.json").writeText(style)
        }
        public.resolve("fonts/JetBrains Mono Regular")
            .copyRecursively(out.resolve("fonts/JetBrains Mono Regular"), overwrite = true)
        // Значки сайта (транспорт, остановки, вокзалы) - рисуются из SVG как есть (AndroidSVG).
        public.resolve("icons").copyRecursively(out.resolve("icons"), overwrite = true)
        val temaki = out.resolve("temaki").apply { mkdirs() }
        for (name in listOf("bus", "tram", "trolleybus", "train_diesel", "board_bus", "board_tram", "board_train_diesel", "airport")) {
            temakiIcons.get().asFile.resolve("$name.svg").copyTo(temaki.resolve("$name.svg"), overwrite = true)
        }
    }
}

/**
 * Иконки интерфейса - те же Tabler, что у сайта (@tabler/icons-react): задача находит в коде
 * сайта все импорты из '@tabler/icons-react' и переводит SVG этих иконок из node_modules в
 * векторные drawable (R.drawable.tabler_<имя>). Красятся цветом, как currentColor на сайте.
 */
abstract class GenerateTablerIcons : DefaultTask() {
    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val webSources: DirectoryProperty

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val tablerIcons: DirectoryProperty

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @TaskAction
    fun generate() {
        val out = outputDir.get().asFile.apply { deleteRecursively() }.resolve("drawable").apply { mkdirs() }
        val importRe = Regex("""import\s*\{([^}]*)\}\s*from\s*'@tabler/icons-react'""")
        val names = sortedSetOf<String>()
        webSources.get().asFile.walkTopDown()
            .filter { it.isFile && (it.extension == "tsx" || it.extension == "ts") && "node_modules" !in it.path }
            .forEach { file ->
                importRe.findAll(file.readText()).forEach { m ->
                    m.groupValues[1].split(',').map { it.trim().substringBefore(" as ").trim() }
                        .filter { it.startsWith("Icon") && it != "Icon" && it != "IconProps" }
                        .forEach(names::add)
                }
            }
        for (name in names) {
            val filled = name.endsWith("Filled")
            val kebab = name.removePrefix("Icon").removeSuffix("Filled")
                .replace(Regex("([a-z0-9])([A-Z])"), "$1-$2").replace(Regex("([A-Za-z])([0-9])"), "$1-$2").lowercase()
            val svg = tablerIcons.get().asFile.resolve("${if (filled) "filled" else "outline"}/$kebab.svg")
            if (!svg.exists()) {
                logger.warn("Tabler: нет иконки $name ($svg)")
                continue
            }
            val res = "tabler_" + (kebab + if (filled) "_filled" else "").replace('-', '_')
            out.resolve("$res.xml").writeText(toVector(svg.readText(), filled))
        }
    }

    private fun attr(tag: String, name: String) = Regex("""\s$name="([^"]*)"""").find(tag)?.groupValues?.get(1)

    private fun toVector(svg: String, filled: Boolean): String {
        val paths = mutableListOf<String>()
        Regex("""<(path|circle|rect|line|polyline|polygon|ellipse)\b[^>]*>""").findAll(svg).forEach { m ->
            val tag = m.value
            if (attr(tag, "stroke") == "none" && attr(tag, "fill") == "none") return@forEach
            val d = when (m.groupValues[1]) {
                "path" -> attr(tag, "d")
                "circle" -> {
                    val cx = attr(tag, "cx")!!.toDouble(); val cy = attr(tag, "cy")!!.toDouble(); val r = attr(tag, "r")!!.toDouble()
                    "M${cx - r},${cy}a$r,$r 0 1,0 ${2 * r},0a$r,$r 0 1,0 ${-2 * r},0"
                }
                "ellipse" -> {
                    val cx = attr(tag, "cx")!!.toDouble(); val cy = attr(tag, "cy")!!.toDouble()
                    val rx = attr(tag, "rx")!!.toDouble(); val ry = attr(tag, "ry")!!.toDouble()
                    "M${cx - rx},${cy}a$rx,$ry 0 1,0 ${2 * rx},0a$rx,$ry 0 1,0 ${-2 * rx},0"
                }
                "rect" -> {
                    val x = attr(tag, "x")?.toDouble() ?: 0.0; val y = attr(tag, "y")?.toDouble() ?: 0.0
                    val w = attr(tag, "width")!!.toDouble(); val h = attr(tag, "height")!!.toDouble()
                    val r = attr(tag, "rx")?.toDouble() ?: 0.0
                    if (r == 0.0) "M$x,${y}h${w}v${h}h${-w}z"
                    else "M${x + r},${y}h${w - 2 * r}a$r,$r 0 0 1 $r,$r" + "v${h - 2 * r}a$r,$r 0 0 1 ${-r},$r" +
                        "h${-(w - 2 * r)}a$r,$r 0 0 1 ${-r},${-r}v${-(h - 2 * r)}a$r,$r 0 0 1 $r,${-r}z"
                }
                "line" -> "M${attr(tag, "x1")},${attr(tag, "y1")}L${attr(tag, "x2")},${attr(tag, "y2")}"
                "polyline", "polygon" -> {
                    val pts = attr(tag, "points")!!.trim().split(Regex("[\\s,]+"))
                    "M" + pts.chunked(2).joinToString("L") { "${it[0]},${it[1]}" } + if (m.groupValues[1] == "polygon") "z" else ""
                }
                else -> null
            } ?: return@forEach
            paths += if (filled || attr(tag, "fill") == "currentColor") {
                """    <path android:pathData="$d" android:fillColor="#FF000000" />"""
            } else {
                """    <path android:pathData="$d" android:fillColor="#00000000" android:strokeColor="#FF000000" """ +
                    """android:strokeWidth="2" android:strokeLineCap="round" android:strokeLineJoin="round" />"""
            }
        }
        return """<?xml version="1.0" encoding="utf-8"?>
<!-- Сгенерировано из @tabler/icons (MIT) задачей generateTablerIcons, не править руками. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
${paths.joinToString("\n")}
</vector>
"""
    }
}

val syncWebAssets = tasks.register<SyncWebAssets>("syncWebAssets") {
    webPublic.set(rootProject.layout.projectDirectory.dir("../passenger/client/public"))
    // pnpm: пакет - симлинк в node_modules/.pnpm, берём настоящий путь.
    temakiIcons.set(
        rootProject.layout.projectDirectory.dir(
            rootProject.file("../passenger/client/node_modules/@rapideditor/temaki").canonicalFile.resolve("icons").path,
        ),
    )
    outputDir.set(layout.buildDirectory.dir("generated/webAssets"))
}

val generateTablerIcons = tasks.register<GenerateTablerIcons>("generateTablerIcons") {
    webSources.set(rootProject.layout.projectDirectory.dir("../passenger/client"))
    // pnpm не поднимает @tabler/icons наверх: он лежит рядом с @tabler/icons-react в
    // node_modules/.pnpm, куда ведёт симлинк client/node_modules/@tabler/icons-react.
    tablerIcons.set(
        rootProject.layout.projectDirectory.dir(
            rootProject.file("../passenger/client/node_modules/@tabler/icons-react")
                .canonicalFile.parentFile.resolve("icons/icons").path,
        ),
    )
    outputDir.set(layout.buildDirectory.dir("generated/tablerRes"))
}

androidComponents {
    onVariants { variant ->
        variant.sources.res?.addGeneratedSourceDirectory(generateTablerIcons, GenerateTablerIcons::outputDir)
        variant.sources.assets?.addGeneratedSourceDirectory(syncWebAssets, SyncWebAssets::outputDir)
    }
}

dependencies {
    implementation(libs.androidx.core)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.datastore)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.foundation)
    implementation(libs.compose.material3)
    implementation(libs.compose.ui.tooling.preview)
    debugImplementation(libs.compose.ui.tooling)
    implementation(libs.maplibre)
    implementation(libs.okhttp)
    implementation(libs.androidsvg)
    implementation(libs.kotlinx.serialization.json)
    testImplementation(libs.junit)
    androidTestImplementation(platform(libs.compose.bom))
    androidTestImplementation(libs.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.ext.junit)
    // Espresso 3.5 из ui-test падает на Android 17 (нет InputManager.getInstance) - нужна свежая.
    androidTestImplementation(libs.androidx.test.espresso)
    debugImplementation(libs.compose.ui.test.manifest)
}
