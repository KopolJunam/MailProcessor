package ch.kopolinfo.mailprocessor.backend.rules

import ch.kopolinfo.mailprocessor.backend.model.LearnRuleRequest
import ch.kopolinfo.mailprocessor.backend.model.LearnRuleResponse
import ch.kopolinfo.mailprocessor.backend.model.LearningMode
import ch.kopolinfo.mailprocessor.backend.persistence.RulesRepository

private const val INBOX_TARGET = "Inbox"

class LearningEngine(
    private val rulesRepository: RulesRepository,
) {
    fun learn(request: LearnRuleRequest): LearnRuleResponse {
        val normalizedAddress = request.from.trim().lowercase()
        val createdPattern =
            when (request.learningMode) {
                LearningMode.USE_ADDRESS -> normalizedAddress
                LearningMode.USE_DOMAIN -> "*@${extractDomain(normalizedAddress)}"
            }

        rulesRepository.upsert(
            addressPattern = createdPattern,
            targetFolder = INBOX_TARGET,
        )

        return LearnRuleResponse(
            requestId = request.requestId,
            createdPattern = createdPattern,
            targetFolder = INBOX_TARGET,
        )
    }

    private fun extractDomain(address: String): String =
        address.substringAfter('@').takeIf { it.isNotBlank() }
            ?: error("Could not extract domain from '$address'")
}
