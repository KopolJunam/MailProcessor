package ch.kopolinfo.mailprocessor.backend.rules

import ch.kopolinfo.mailprocessor.backend.model.ClassificationRequest
import ch.kopolinfo.mailprocessor.backend.model.ClassificationResponse

fun interface MailClassifier {
    fun classify(request: ClassificationRequest): ClassificationResponse
}
