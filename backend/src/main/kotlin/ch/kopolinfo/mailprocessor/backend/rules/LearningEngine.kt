package ch.kopolinfo.mailprocessor.backend.rules

import ch.kopolinfo.mailprocessor.backend.model.LearnRuleRequest
import ch.kopolinfo.mailprocessor.backend.model.LearnRuleResponse
import ch.kopolinfo.mailprocessor.backend.model.LearningMode
import ch.kopolinfo.mailprocessor.backend.persistence.RulesRepository

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
            subjectRegex = null,
            targetFolder = request.targetFolder,
        )

        return LearnRuleResponse(
            requestId = request.requestId,
            createdPattern = createdPattern,
            targetFolder = request.targetFolder,
        )
    }

    private fun extractDomain(address: String): String =
        address.substringAfter('@').takeIf { it.isNotBlank() }
            ?: error("Could not extract domain from '$address'")
}
