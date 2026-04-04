package ch.kopolinfo.mailprocessor.backend.rules

import ch.kopolinfo.mailprocessor.backend.model.ClassificationRequest
import ch.kopolinfo.mailprocessor.backend.model.ClassificationResponse

const val FALLBACK = "_Candidates"

data class RuleMatch(
    val name: String,
    val targetFolder: String,
)

fun interface MailRule {
    fun match(request: ClassificationRequest): RuleMatch?
}

class RuleEngine(
    private val rules: List<MailRule> = emptyList(),
    private val fallbackFolder: String = FALLBACK,
) : MailClassifier {
    override fun classify(request: ClassificationRequest): ClassificationResponse {
        val match = rules.firstNotNullOfOrNull { it.match(request) }

        return ClassificationResponse(
            requestId = request.requestId,
            targetFolder = match?.targetFolder ?: fallbackFolder,
            matchedRule = match?.name,
        )
    }
}
