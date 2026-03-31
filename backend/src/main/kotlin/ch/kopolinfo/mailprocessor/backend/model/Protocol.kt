package ch.kopolinfo.mailprocessor.backend.model

import kotlinx.serialization.Serializable

@Serializable
data class ClassificationRequest(
    val type: String,
    val requestId: String,
    val from: String,
)

@Serializable
data class ClassificationResponse(
    val type: String = "classification-result",
    val requestId: String,
    val applyTag: Boolean,
    val tagKey: String? = null,
)
