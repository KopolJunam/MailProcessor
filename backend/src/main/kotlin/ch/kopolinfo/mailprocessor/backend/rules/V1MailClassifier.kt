package ch.kopolinfo.mailprocessor.backend.rules

import ch.kopolinfo.mailprocessor.backend.model.ClassificationRequest
import ch.kopolinfo.mailprocessor.backend.model.ClassificationResponse

private const val IMPORTANT_SENDER = "thomas.maurer@ergon.ch"
private const val IMPORTANT_TAG = "\$label1"

class V1MailClassifier : MailClassifier {
    override fun classify(request: ClassificationRequest): ClassificationResponse {
        val normalizedSender = request.from.trim().lowercase()
        val shouldApplyTag = normalizedSender == IMPORTANT_SENDER

        return ClassificationResponse(
            requestId = request.requestId,
            applyTag = shouldApplyTag,
            tagKey = IMPORTANT_TAG.takeIf { shouldApplyTag },
        )
    }
}
