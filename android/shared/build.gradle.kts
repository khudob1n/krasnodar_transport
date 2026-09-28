import org.gradle.api.DefaultTask
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.tasks.InputDirectory
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.OutputDirectory
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction

plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.android.kmp.library)
    alias(libs.plugins.compose.multiplatform)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

/**
 * Стили карты и значки - из пассажирского сайта (passenger/client/public), единый источник для
 * сайта и приложения. Всё попадает в Kotlin-код (WebAssets.kt) текстом: SVG рисует общий код
 * (ui/components/Svg.kt) на Android и iOS одинаково, без файлов ресурсов платформы.
 *
 * Tabler - иконки интерфейса, те же, что у сайта (@tabler/icons-react): задача находит в коде сайта
 * все импорты из '@tabler/icons-react' и берёт SVG этих иконок из node_modules (Tabler.<имя>).
 */
abstract class GenerateWebAssets : DefaultTask() {
    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val webPublic: DirectoryProperty

    /** Код сайта (.ts/.tsx без node_modules) - в нём ищутся импорты Tabler. */
    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val webSources: ConfigurableFileCollection

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val temakiIcons: DirectoryProperty

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val tablerIcons: DirectoryProperty

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    private fun literal(text: String) = "\"\"\"" + text.replace("\$", "\${'\$'}") + "\"\"\""

    @TaskAction
    fun generate() {
        val out = outputDir.get().asFile.apply { deleteRecursively() }
            .resolve("ru/khudob1n/krasnodar/transport/assets").apply { mkdirs() }
        val public = webPublic.get().asFile
        val code = StringBuilder()
        code.appendLine("// Сгенерировано задачей generateWebAssets из passenger/client, не править руками.")
        code.appendLine("package ru.khudob1n.krasnodar.transport.assets")
        code.appendLine()
        code.appendLine("import ru.khudob1n.krasnodar.transport.ui.components.SvgIcon")
        code.appendLine()
        code.appendLine("object WebAssets {")
        for (theme in listOf("light", "dark")) {
            code.appendLine("    val mapStyle${theme.replaceFirstChar { it.uppercase() }}: String = ${literal(public.resolve("map-style-$theme.json").readText())}")
        }
        code.appendLine()
        code.appendLine("    /** Значки сайта (public/icons) по имени файла без .svg. */")
        code.appendLine("    val icons: Map<String, SvgIcon> = mapOf(")
        public.resolve("icons").listFiles { f -> f.extension == "svg" }!!.sortedBy { it.name }.forEach { f ->
            code.appendLine("        \"${f.nameWithoutExtension}\" to SvgIcon(\"${f.nameWithoutExtension}\", ${literal(f.readText())}),")
        }
        code.appendLine("    )")
        code.appendLine()
        code.appendLine("    /** Пиктограммы транспорта Temaki - их сайт рисует в маркерах машин и остановок (TransportIcon). */")
        code.appendLine("    val temaki: Map<String, SvgIcon> = mapOf(")
        for (name in listOf("bus", "tram", "trolleybus", "train_diesel", "board_bus", "board_tram", "board_train_diesel", "airport")) {
            code.appendLine("        \"$name\" to SvgIcon(\"temaki_$name\", ${literal(temakiIcons.get().asFile.resolve("$name.svg").readText())}),")
        }
        code.appendLine("    )")
        code.appendLine("}")
        out.resolve("WebAssets.kt").writeText(code.toString())

        // Tabler: все иконки, что импортирует сайт.
        val importRe = Regex("""import\s*\{([^}]*)\}\s*from\s*'@tabler/icons-react'""")
        val names = sortedSetOf<String>()
        webSources.files.forEach { file ->
                importRe.findAll(file.readText()).forEach { m ->
                    m.groupValues[1].split(',').map { it.trim().substringBefore(" as ").trim() }
                        .filter { it.startsWith("Icon") && it != "Icon" && it != "IconProps" }
                        .forEach(names::add)
                }
            }
        val tabler = StringBuilder()
        tabler.appendLine("// Сгенерировано задачей generateWebAssets из @tabler/icons (MIT), не править руками.")
        tabler.appendLine("@file:Suppress(\"ObjectPropertyName\")")
        tabler.appendLine("package ru.khudob1n.krasnodar.transport.assets")
        tabler.appendLine()
        tabler.appendLine("import ru.khudob1n.krasnodar.transport.ui.components.SvgIcon")
        tabler.appendLine()
        tabler.appendLine("/** Иконки интерфейса сайта: stroke/fill - currentColor, красятся цветом, как на сайте. */")
        tabler.appendLine("object Tabler {")
        for (name in names) {
            val filled = name.endsWith("Filled")
            val kebab = name.removePrefix("Icon").removeSuffix("Filled")
                .replace(Regex("([a-z0-9])([A-Z])"), "$1-$2").replace(Regex("([A-Za-z])([0-9])"), "$1-$2").lowercase()
            val svg = tablerIcons.get().asFile.resolve("${if (filled) "filled" else "outline"}/$kebab.svg")
            if (!svg.exists()) {
                logger.warn("Tabler: нет иконки $name ($svg)")
                continue
            }
            val id = (kebab + if (filled) "_filled" else "").replace('-', '_')
            tabler.appendLine("    val $id: SvgIcon = SvgIcon(\"tabler_$id\", ${literal(svg.readText())})")
        }
        tabler.appendLine("}")
        out.resolve("Tabler.kt").writeText(tabler.toString())
    }
}

val generateWebAssets = tasks.register<GenerateWebAssets>("generateWebAssets") {
    val client = rootProject.file("../passenger/client")
    webPublic.set(client.resolve("public"))
    webSources.from(fileTree(client) { include("**/*.ts", "**/*.tsx"); exclude("**/node_modules/**", "**/.next/**") })
    // pnpm: пакеты - симлинки в node_modules/.pnpm, берём настоящие пути.
    temakiIcons.set(client.resolve("node_modules/@rapideditor/temaki").canonicalFile.resolve("icons"))
    tablerIcons.set(client.resolve("node_modules/@tabler/icons-react").canonicalFile.parentFile.resolve("icons/icons"))
    outputDir.set(layout.buildDirectory.dir("generated/webAssets/commonMain/kotlin"))
}

kotlin {
    android {
        namespace = "ru.khudob1n.krasnodar.shared"
        compileSdk = 37
        minSdk = 26
        // Шрифты - ресурсы Compose Multiplatform (composeResources/font).
        androidResources { enable = true }
        // Тесты общей логики - на JVM (им нужны файлы данных из репозитория).
        withHostTest {}
    }
    // Библиотека для iOS-приложения (iosApp): статический фреймворк Shared.
    listOf(iosArm64(), iosSimulatorArm64()).forEach { target ->
        target.binaries.framework {
            baseName = "Shared"
            isStatic = true
        }
    }

    sourceSets {
        commonMain {
            kotlin.srcDir(generateWebAssets.map { it.outputDir })
        }
        commonMain.dependencies {
            implementation(libs.cmp.runtime)
            implementation(libs.cmp.foundation)
            implementation(libs.cmp.ui)
            implementation(libs.cmp.material3)
            implementation(libs.cmp.resources)
            implementation(libs.cmp.backhandler)
            implementation(libs.cmp.lifecycle.runtime)
            implementation(libs.kotlinx.datetime)
            implementation(libs.kotlinx.io)
            implementation(libs.datastore.preferences.core)
            implementation(libs.okio)
            implementation(libs.maplibre.compose)
            implementation(libs.ktor.client.core)
            implementation(libs.kotlinx.serialization.json)
            implementation(libs.kotlinx.coroutines.core)
        }
        commonTest.dependencies {
            implementation(kotlin("test"))
        }
        getByName("androidHostTest").dependencies {
            implementation(libs.junit)
        }
        androidMain.dependencies {
            implementation(libs.ktor.client.okhttp)
            implementation(libs.androidx.activity.compose)
            implementation(libs.androidx.core)
            implementation(libs.maplibre.compose.runtime.android)
        }
        iosMain.dependencies {
            implementation(libs.ktor.client.darwin)
        }
    }
}

compose.resources {
    packageOfResClass = "ru.khudob1n.krasnodar.transport.resources"
    publicResClass = true
}
