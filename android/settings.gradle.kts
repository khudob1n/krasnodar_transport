pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "KrasnodarTransport"
include(":app")
// Общий код Android и iOS (пока - проверка карты на iPhone, см. shared/README).
include(":shared")
