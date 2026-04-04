package ch.kopolinfo.mailprocessor.backend.service

import ch.kopolinfo.mailprocessor.backend.model.ClassificationRequest
import ch.kopolinfo.mailprocessor.backend.model.LearnRuleRequest
import ch.kopolinfo.mailprocessor.backend.nativehost.NativeMessageHandler
import ch.kopolinfo.mailprocessor.backend.rules.LearningEngine
import ch.kopolinfo.mailprocessor.backend.rules.MailClassifier
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

class MailProcessorService(
    private val classifier: MailClassifier,
    private val learningEngine: LearningEngine,
    private val json: Json =
        Json {
            encodeDefaults = true
            ignoreUnknownKeys = true
            explicitNulls = false
        },
) : NativeMessageHandler {
    override fun handle(rawMessage: String): String {
        val messageType =
            json
                .parseToJsonElement(rawMessage)
                .jsonObject["type"]
                ?.jsonPrimitive
                ?.content
                ?: error("Incoming native message is missing a type field")

        return when (messageType) {
            "classify-mail" ->
                json.encodeToString(
                    classifier.classify(
                        json.decodeFromString<ClassificationRequest>(rawMessage),
                    ),
                )

            "learn-rule" ->
                json.encodeToString(
                    learningEngine.learn(
                        json.decodeFromString<LearnRuleRequest>(rawMessage),
                    ),
                )

            else -> error("Unsupported native message type '$messageType'")
        }
    }
}
