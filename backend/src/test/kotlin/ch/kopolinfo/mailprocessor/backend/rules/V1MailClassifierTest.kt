package ch.kopolinfo.mailprocessor.backend.rules

import ch.kopolinfo.mailprocessor.backend.model.ClassificationRequest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class V1MailClassifierTest {
    private val classifier = V1MailClassifier()

    @Test
    fun tagsConfiguredSender() {
        val response =
            classifier.classify(
                ClassificationRequest(
                    type = "classify-mail",
                    requestId = "request-1",
                    from = "Thomas.Maurer@ergon.ch",
                ),
            )

        assertTrue(response.applyTag)
        assertEquals("\$label1", response.tagKey)
    }

    @Test
    fun ignoresOtherSenders() {
        val response =
            classifier.classify(
                ClassificationRequest(
                    type = "classify-mail",
                    requestId = "request-2",
                    from = "someone@example.invalid",
                ),
            )

        assertFalse(response.applyTag)
        assertEquals(null, response.tagKey)
    }
}
