package ch.kopolinfo.mailprocessor.backend.persistence

import java.nio.file.Files
import kotlin.io.path.absolutePathString
import kotlin.test.Test
import kotlin.test.assertEquals

class RulesRepositoryTest {
    @Test
    fun insertsAndReadsRules() {
        val tempDirectory = Files.createTempDirectory("mailprocessor-rules-test")
        val support =
            DatabaseBootstrap.initialize(
                tempDirectory.resolve("MailProcessor").absolutePathString(),
            )
        SqlSchemaInitializer().ensureExists(support.dsl)
        val repository = RulesRepository(support.dsl)

        val inserted = repository.insert("*@gugus.ch", "/Inbox")
        val rules = repository.findAll()

        assertEquals(1, inserted.id)
        assertEquals(
            listOf(
                RuleEntry(
                    id = inserted.id,
                    addressPattern = "*@gugus.ch",
                    subjectRegex = null,
                    targetFolder = "/Inbox",
                ),
            ),
            rules,
        )
    }

    @Test
    fun storesOptionalSubjectRegex() {
        val tempDirectory = Files.createTempDirectory("mailprocessor-rules-subject-test")
        val support =
            DatabaseBootstrap.initialize(
                tempDirectory.resolve("MailProcessor").absolutePathString(),
            )
        SqlSchemaInitializer().ensureExists(support.dsl)
        val repository = RulesRepository(support.dsl)

        val inserted = repository.insert("alerts@example.invalid", "/Invoices", subjectRegex = "Invoice\\s+#\\d+")

        assertEquals("Invoice\\s+#\\d+", inserted.subjectRegex)
        assertEquals("/Invoices", inserted.targetFolder)
        assertEquals(
            listOf("Invoice\\s+#\\d+"),
            repository.findAll().map { it.subjectRegex },
        )
    }

    @Test
    fun normalizesLegacyTargetFolderWithoutLeadingSlash() {
        val tempDirectory = Files.createTempDirectory("mailprocessor-rules-normalization-test")
        val support =
            DatabaseBootstrap.initialize(
                tempDirectory.resolve("MailProcessor").absolutePathString(),
            )
        SqlSchemaInitializer().ensureExists(support.dsl)
        val repository = RulesRepository(support.dsl)

        val inserted = repository.insert("*@legacy.example", "Invoices/Neu")

        assertEquals("/Invoices/Neu", inserted.targetFolder)
    }
}
