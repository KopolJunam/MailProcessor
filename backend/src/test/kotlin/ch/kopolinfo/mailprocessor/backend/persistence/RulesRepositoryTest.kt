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

        val inserted = repository.insert("*@gugus.ch", "Inbox")
        val rules = repository.findAll()

        assertEquals(1, inserted.id)
        assertEquals(
            listOf(
                RuleEntry(
                    id = inserted.id,
                    addressPattern = "*@gugus.ch",
                    targetFolder = "Inbox",
                ),
            ),
            rules,
        )
    }
}
