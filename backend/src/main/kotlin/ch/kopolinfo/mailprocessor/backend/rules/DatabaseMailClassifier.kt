package ch.kopolinfo.mailprocessor.backend.rules

import ch.kopolinfo.mailprocessor.backend.model.ClassificationRequest
import ch.kopolinfo.mailprocessor.backend.persistence.RuleEntry
import ch.kopolinfo.mailprocessor.backend.persistence.RulesRepository

class DatabaseMailClassifier(
    private val rulesRepository: RulesRepository,
) : MailClassifier {
    override fun classify(request: ClassificationRequest) =
        RuleEngine(
            rules = rulesRepository.findAll().toMailRules(),
            fallbackFolder = FALLBACK,
        ).classify(
            request.copy(from = request.from.trim().lowercase()),
        )
}

private fun List<RuleEntry>.toMailRules(): List<MailRule> =
    sortedWith(
        compareBy(
            { if (it.addressPattern.startsWith("*@")) 1 else 0 },
            { if (it.subjectRegex == null) 1 else 0 },
            { it.id },
        ),
    ).map { entry ->
        MailRule { request ->
            if (entry.matches(request.from, request.subject)) {
                RuleMatch(
                    name = entry.describe(),
                    targetFolder = entry.targetFolder,
                )
            } else {
                null
            }
        }
    }

private fun RuleEntry.matches(
    address: String,
    subject: String,
): Boolean {
    val normalizedAddress = address.trim().lowercase()
    val normalizedPattern = addressPattern.trim().lowercase()

    val senderMatches =
        if (normalizedPattern.startsWith("*@")) {
            normalizedAddress.endsWith(normalizedPattern.removePrefix("*"))
        } else {
            normalizedAddress == normalizedPattern
        }

    if (!senderMatches) {
        return false
    }

    val configuredSubjectRegex = subjectRegex?.trim()?.takeIf { it.isNotEmpty() } ?: return true
    return Regex(configuredSubjectRegex).containsMatchIn(subject)
}

private fun RuleEntry.describe(): String =
    subjectRegex?.trim()?.takeIf { it.isNotEmpty() }?.let { "$addressPattern && subject~/$it/" } ?: addressPattern
