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
        compareBy<RuleEntry>(
            { if (it.addressPattern.startsWith("*@")) 1 else 0 },
            { it.id },
        ),
    ).map { entry ->
        MailRule { request ->
            if (entry.matches(request.from)) {
                RuleMatch(
                    name = entry.addressPattern,
                    targetFolder = entry.targetFolder,
                )
            } else {
                null
            }
        }
    }

private fun RuleEntry.matches(address: String): Boolean {
    val normalizedAddress = address.trim().lowercase()
    val normalizedPattern = addressPattern.trim().lowercase()

    return if (normalizedPattern.startsWith("*@")) {
        normalizedAddress.endsWith(normalizedPattern.removePrefix("*"))
    } else {
        normalizedAddress == normalizedPattern
    }
}
