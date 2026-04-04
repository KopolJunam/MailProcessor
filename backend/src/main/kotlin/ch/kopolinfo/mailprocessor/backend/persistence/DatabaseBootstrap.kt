package ch.kopolinfo.mailprocessor.backend.persistence

import org.jooq.DSLContext
import org.jooq.impl.DSL
import java.nio.file.Files
import java.nio.file.Path

private const val DEFAULT_DATABASE_BASE_PATH = """N:\Privat\Administrativ\MailProcessor"""
private const val DEFAULT_DATABASE_OPTIONS = ""

data class DatabaseConfig(
    val basePath: String,
    val jdbcUrl: String,
)

data class DatabaseSupport(
    val config: DatabaseConfig,
    val dsl: DSLContext,
)

object DatabaseBootstrap {
    fun initialize(basePathOverride: String? = null): DatabaseSupport {
        val config = createConfig(basePathOverride)
        ensureParentDirectoryExists(config.basePath)

        return DatabaseSupport(
            config = config,
            dsl = DSL.using(config.jdbcUrl),
        )
    }

    fun createConfig(basePathOverride: String? = null): DatabaseConfig {
        val basePath =
            basePathOverride
                ?.takeIf { it.isNotBlank() }
                ?: System
                    .getProperty("mailprocessor.db.path")
                    ?.takeIf { it.isNotBlank() }
                ?: DEFAULT_DATABASE_BASE_PATH

        val normalizedPath =
            Path
                .of(basePath)
                .toAbsolutePath()
                .toString()
                .replace("\\", "/")

        return DatabaseConfig(
            basePath = Path.of(basePath).toAbsolutePath().toString(),
            jdbcUrl = "jdbc:h2:file:$normalizedPath$DEFAULT_DATABASE_OPTIONS",
        )
    }

    private fun ensureParentDirectoryExists(basePath: String) {
        val parent = Path.of(basePath).toAbsolutePath().parent ?: return
        Files.createDirectories(parent)
    }
}
