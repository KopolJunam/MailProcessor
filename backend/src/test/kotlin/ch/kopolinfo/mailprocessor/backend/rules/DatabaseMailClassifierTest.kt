package ch.kopolinfo.mailprocessor.backend.rules

import ch.kopolinfo.mailprocessor.backend.model.ClassificationRequest
import ch.kopolinfo.mailprocessor.backend.persistence.DatabaseBootstrap
import ch.kopolinfo.mailprocessor.backend.persistence.RulesRepository
import ch.kopolinfo.mailprocessor.backend.persistence.SqlSchemaInitializer
import java.nio.file.Files
import kotlin.io.path.absolutePathString
import kotlin.test.Test
import kotlin.test.assertEquals

class DatabaseMailClassifierTest {
    @Test
    fun exactAddressRuleWinsOverDomainRule() {
        val tempDirectory = Files.createTempDirectory("mailprocessor-classifier-test")
        val support =
            DatabaseBootstrap.initialize(
                tempDirectory.resolve("MailProcessor").absolutePathString(),
            )
        SqlSchemaInitializer().ensureExists(support.dsl)
        val repository = RulesRepository(support.dsl)
        repository.insert("*@ergon.ch", "DomainInbox")
        repository.insert("thomas.maurer@ergon.ch", "Inbox")

        val classifier = DatabaseMailClassifier(repository)

        val response =
            classifier.classify(
                ClassificationRequest(
                    type = "classify-mail",
                    requestId = "request-1",
                    from = "Thomas.Maurer@ergon.ch",
                ),
            )

        assertEquals("Inbox", response.targetFolder)
        assertEquals("thomas.maurer@ergon.ch", response.matchedRule)
    }
}
