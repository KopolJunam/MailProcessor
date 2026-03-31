package ch.kopolinfo.mailprocessor.backend.persistence

import java.nio.file.Files
import kotlin.io.path.absolutePathString
import kotlin.io.path.exists
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class DatabaseBootstrapTest {
    @Test
    fun createsH2DatabaseFile() {
        val tempDirectory = Files.createTempDirectory("mailprocessor-db-test")
        val databaseBasePath = tempDirectory.resolve("MailProcessor").absolutePathString()

        val support = DatabaseBootstrap.initialize(databaseBasePath)
        support.dsl.meta()

        assertTrue(tempDirectory.resolve("MailProcessor.mv.db").exists())
        assertEquals(
            "jdbc:h2:file:${databaseBasePath.replace("\\", "/")};AUTO_SERVER=TRUE",
            support.config.jdbcUrl,
        )
    }

    @Test
    fun usesConfiguredBasePathInJdbcUrl() {
        val config = DatabaseBootstrap.createConfig("""N:\Privat\Administrativ\MailProcessor""")

        assertEquals(
            """jdbc:h2:file:N:/Privat/Administrativ/MailProcessor;AUTO_SERVER=TRUE""",
            config.jdbcUrl,
        )
    }
}
