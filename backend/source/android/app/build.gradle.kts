plugins {
    id("com.android.application")
}

android {
    namespace = "com.cloudphone.iconhelper"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.cloudphone.iconhelper"
        minSdk = 24
        targetSdk = 34
        versionCode = 3
        versionName = "1.2.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

dependencies {
    // Intentionally empty — keep the helper APK tiny.
}

tasks.register<Copy>("copyReleaseToBin") {
    dependsOn("assembleRelease")
    from(layout.buildDirectory.file("outputs/apk/release/app-release.apk"))
    into(rootProject.layout.projectDirectory.dir("../../bin/android"))
    rename { "cloud-phone-icon-helper.apk" }
    doLast {
        val versionFile = rootProject.layout.projectDirectory
            .file("../../bin/android/cloud-phone-icon-helper.version")
            .asFile
        versionFile.parentFile.mkdirs()
        versionFile.writeText(android.defaultConfig.versionCode.toString())
    }
}
