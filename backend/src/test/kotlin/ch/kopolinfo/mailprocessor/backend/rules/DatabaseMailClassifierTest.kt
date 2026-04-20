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
        repository.insert("*@ergon.ch", "/DomainInbox")
        repository.insert("thomas.maurer@ergon.ch", "/Inbox")

        val classifier = DatabaseMailClassifier(repository)

        val response =
            classifier.classify(
                ClassificationRequest(
                    type = "classify-mail",
                    requestId = "request-1",
                    from = "Thomas.Maurer@ergon.ch",
                    subject = "Quarterly update",
                ),
            )

        assertEquals("/Inbox", response.targetFolder)
        assertEquals("thomas.maurer@ergon.ch", response.matchedRule)
    }

    @Test
    fun subjectRegexCanNarrowSenderRule() {
        val tempDirectory = Files.createTempDirectory("mailprocessor-classifier-subject-test")
        val support =
            DatabaseBootstrap.initialize(
                tempDirectory.resolve("MailProcessor").absolutePathString(),
            )
        SqlSchemaInitializer().ensureExists(support.dsl)
        val repository = RulesRepository(support.dsl)
        repository.insert("alerts@example.invalid", "/Inbox", subjectRegex = "Invoice\\s+#\\d+")
        repository.insert("alerts@example.invalid", "/FallbackInbox")

        val classifier = DatabaseMailClassifier(repository)

        val matchingResponse =
            classifier.classify(
                ClassificationRequest(
                    type = "classify-mail",
                    requestId = "request-2",
                    from = "alerts@example.invalid",
                    subject = "Invoice #4711 available",
                ),
            )
        val nonMatchingResponse =
            classifier.classify(
                ClassificationRequest(
                    type = "classify-mail",
                    requestId = "request-3",
                    from = "alerts@example.invalid",
                    subject = "General notification",
                ),
            )

        assertEquals("/Inbox", matchingResponse.targetFolder)
        assertEquals("/FallbackInbox", nonMatchingResponse.targetFolder)
    }
}
