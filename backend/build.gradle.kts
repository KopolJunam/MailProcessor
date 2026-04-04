import org.jetbrains.kotlin.gradle.tasks.KotlinCompile
import org.jlleitschuh.gradle.ktlint.tasks.BaseKtLintCheckTask

val defaultDbBasePath = """N:\Privat\Administrativ\MailProcessor"""
val configuredDbBasePath =
    providers
        .gradleProperty("mailprocessorDbPath")
        .orElse(defaultDbBasePath)
        .get()
val configuredJdbcUrl =
    "jdbc:h2:file:${configuredDbBasePath.replace("\\", "/")}"

plugins {
    kotlin("jvm") version "2.1.20"
    kotlin("plugin.serialization") version "2.1.20"
    application
    id("org.jooq.jooq-codegen-gradle") version "3.20.8"
    id("org.jlleitschuh.gradle.ktlint") version "14.0.1"
}

group = "ch.kopolinfo.mailprocessor"
version = "0.1.0-SNAPSHOT"

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.jooq:jooq:3.20.8")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")
    implementation("com.h2database:h2:2.3.232")
    jooqCodegen("com.h2database:h2:2.3.232")
    testImplementation(kotlin("test"))
}

kotlin {
    jvmToolchain(21)
}

application {
    mainClass = "ch.kopolinfo.mailprocessor.backend.MainKt"
}

jooq {
    configuration {
        jdbc {
            driver = "org.h2.Driver"
            url = configuredJdbcUrl
        }
        generator {
            name = "org.jooq.codegen.KotlinGenerator"
            database {
                name = "org.jooq.meta.h2.H2Database"
                inputSchema = "PUBLIC"
            }
            target {
                packageName = "ch.kopolinfo.mailprocessor.backend.jooq"
                directory =
                    layout.buildDirectory
                        .dir("generated-src/jooq/main")
                        .get()
                        .asFile
                        .path
            }
        }
    }
}

val bootstrapDatabaseSchema by tasks.registering(JavaExec::class) {
    classpath = configurations.named("jooqCodegen").get()
    mainClass.set("org.h2.tools.RunScript")
    args(
        "-url",
        configuredJdbcUrl,
        "-script",
        layout.projectDirectory
            .file("src/main/resources/db/schema.sql")
            .asFile.absolutePath,
    )
}

ktlint {
    filter {
        include("src/**/*.kt")
        include("*.kts")
    }
}

tasks.named("jooqCodegen") {
    dependsOn(bootstrapDatabaseSchema)
}

tasks.named<KotlinCompile>("compileKotlin") {
    dependsOn(tasks.named("jooqCodegen"))
    source(layout.buildDirectory.dir("generated-src/jooq/main"))
}

listOf(
    "runKtlintCheckOverMainSourceSet",
    "runKtlintFormatOverMainSourceSet",
).forEach { taskName ->
    tasks.named<BaseKtLintCheckTask>(taskName) {
        dependsOn(tasks.named("jooqCodegen"))
        setSource(
            fileTree("src/main/kotlin") {
                include("**/*.kt")
            },
        )
    }
}

tasks.test {
    useJUnitPlatform()
}
