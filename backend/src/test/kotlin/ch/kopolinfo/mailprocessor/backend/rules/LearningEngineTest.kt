package ch.kopolinfo.mailprocessor.backend.rules

import ch.kopolinfo.mailprocessor.backend.model.LearnRuleRequest
import ch.kopolinfo.mailprocessor.backend.model.LearningMode
import ch.kopolinfo.mailprocessor.backend.persistence.DatabaseBootstrap
import ch.kopolinfo.mailprocessor.backend.persistence.RulesRepository
import ch.kopolinfo.mailprocessor.backend.persistence.SqlSchemaInitializer
import java.nio.file.Files
import kotlin.io.path.absolutePathString
import kotlin.test.Test
import kotlin.test.assertEquals

class LearningEngineTest {
    @Test
    fun createsExactAddressRuleForUseAddress() {
        val tempDirectory = Files.createTempDirectory("mailprocessor-learning-address-test")
        val support =
            DatabaseBootstrap.initialize(
                tempDirectory.resolve("MailProcessor").absolutePathString(),
            )
        SqlSchemaInitializer().ensureExists(support.dsl)
        val repository = RulesRepository(support.dsl)
        val engine = LearningEngine(repository)

        val response =
            engine.learn(
                LearnRuleRequest(
                    type = "learn-rule",
                    requestId = "request-1",
                    from = "Thomas.Maurer@ergon.ch",
                    learningMode = LearningMode.USE_ADDRESS,
                ),
            )

        assertEquals("thomas.maurer@ergon.ch", response.createdPattern)
        assertEquals("/Inbox", response.targetFolder)
        assertEquals(
            listOf("thomas.maurer@ergon.ch"),
            repository.findAll().map { it.addressPattern },
        )
        assertEquals(
            listOf<String?>(null),
            repository.findAll().map { it.subjectRegex },
        )
    }

    @Test
    fun createsDomainRuleForUseDomain() {
        val tempDirectory = Files.createTempDirectory("mailprocessor-learning-domain-test")
        val support =
            DatabaseBootstrap.initialize(
                tempDirectory.resolve("MailProcessor").absolutePathString(),
            )
        SqlSchemaInitializer().ensureExists(support.dsl)
        val repository = RulesRepository(support.dsl)
        val engine = LearningEngine(repository)

        val response =
            engine.learn(
                LearnRuleRequest(
                    type = "learn-rule",
                    requestId = "request-2",
                    from = "Thomas.Maurer@ergon.ch",
                    learningMode = LearningMode.USE_DOMAIN,
                ),
            )

        assertEquals("*@ergon.ch", response.createdPattern)
        assertEquals("/Inbox", response.targetFolder)
        assertEquals(
            listOf("*@ergon.ch"),
            repository.findAll().map { it.addressPattern },
        )
        assertEquals(
            listOf<String?>(null),
            repository.findAll().map { it.subjectRegex },
        )
    }
}
