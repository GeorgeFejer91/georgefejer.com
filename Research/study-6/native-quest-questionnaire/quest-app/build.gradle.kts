plugins {
    id("com.android.application")
    id("com.meta.spatial.plugin")
}

android {
    namespace = "com.georgefejer.study6.quest"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.georgefejer.study6.quest"
        minSdk = 34
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0-dev"
    }

    sourceSets {
        getByName("main") {
            assets.srcDir(layout.buildDirectory.dir("generated/study6Assets"))
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

}

dependencies {
    implementation("com.meta.spatial:meta-spatial-sdk:0.13.0")
    implementation("com.meta.spatial:meta-spatial-sdk-compose:0.13.0")
    implementation("com.meta.spatial:meta-spatial-sdk-toolkit:0.13.0")
    implementation("com.meta.spatial:meta-spatial-sdk-vr:0.13.0")
}

val studyRoot = rootProject.projectDir.parentFile
val generatedAssets = layout.buildDirectory.dir("generated/study6Assets")

tasks.register<Sync>("prepareStudy6Assets") {
    into(generatedAssets)
    from(studyRoot.resolve("questionnaire-assets/sam")) {
        into("questionnaire-assets/sam")
    }
    from(studyRoot.resolve("neutral-hand-audio/audio")) {
        into("neutral-hand-audio/audio")
    }
    from(studyRoot.resolve("for-ai/study6_apk_permutation_lookup.json")) {
        into("for-ai")
    }
}

tasks.named("preBuild") {
    dependsOn("prepareStudy6Assets")
}
