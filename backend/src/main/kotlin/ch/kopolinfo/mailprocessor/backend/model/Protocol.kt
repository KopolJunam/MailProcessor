package ch.kopolinfo.mailprocessor.backend.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ClassificationRequest(
    val type: String,
    val requestId: String,
    val from: String,
    val subject: String,
)

@Serializable
data class LearnRuleRequest(
    val type: String,
    val requestId: String,
    val from: String,
    val learningMode: LearningMode,
)

@Serializable
enum class LearningMode {
    @SerialName("use-address")
    USE_ADDRESS,

    @SerialName("use-domain")
    USE_DOMAIN,
}

@Serializable
data class ClassificationResponse(
    val type: String = "classification-result",
    val requestId: String,
    val targetFolder: String,
    val matchedRule: String? = null,
)

@Serializable
data class LearnRuleResponse(
    val type: String = "learning-result",
    val requestId: String,
    val createdPattern: String,
    val targetFolder: String,
)
