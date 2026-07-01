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

rootProject.name = "study6-native-quest-questionnaire"

include(":questionnaire-core")

val hasAndroidSdk = System.getenv("ANDROID_HOME").orEmpty().isNotBlank() ||
    System.getenv("ANDROID_SDK_ROOT").orEmpty().isNotBlank() ||
    rootDir.resolve("android-sdk/platforms").isDirectory ||
    providers.gradleProperty("includeAndroidModules").orNull == "true"

if (hasAndroidSdk) {
    include(":quest-app")
}
