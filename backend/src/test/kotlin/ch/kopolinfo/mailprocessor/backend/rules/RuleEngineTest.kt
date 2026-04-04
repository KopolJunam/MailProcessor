package ch.kopolinfo.mailprocessor.backend.rules

import ch.kopolinfo.mailprocessor.backend.model.ClassificationRequest
import kotlin.test.Test
import kotlin.test.assertEquals

class RuleEngineTest {
    @Test
    fun usesFallbackFolderWhenNoRuleMatches() {
        val engine = RuleEngine()

        val response =
            engine.classify(
                ClassificationRequest(
                    type = "classify-mail",
                    requestId = "request-1",
                    from = "someone@example.invalid",
                ),
            )

        assertEquals(FALLBACK, response.targetFolder)
        assertEquals(null, response.matchedRule)
    }

    @Test
    fun returnsFirstMatchingRuleTargetFolder() {
        val engine =
            RuleEngine(
                rules =
                    listOf(
                        MailRule { request ->
                            if (request.from.endsWith("@example.invalid")) {
                                RuleMatch(
                                    name = "example-domain",
                                    targetFolder = "Inbox_",
                                )
                            } else {
                                null
                            }
                        },
                        MailRule {
                            RuleMatch(
                                name = "late-rule",
                                targetFolder = "Ignored_",
                            )
                        },
                    ),
            )

        val response =
            engine.classify(
                ClassificationRequest(
                    type = "classify-mail",
                    requestId = "request-2",
                    from = "someone@example.invalid",
                ),
            )

        assertEquals("Inbox_", response.targetFolder)
        assertEquals("example-domain", response.matchedRule)
    }
}
