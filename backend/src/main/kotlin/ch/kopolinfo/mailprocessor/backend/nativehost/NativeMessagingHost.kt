package ch.kopolinfo.mailprocessor.backend.nativehost

import ch.kopolinfo.mailprocessor.backend.model.ClassificationRequest
import ch.kopolinfo.mailprocessor.backend.rules.MailClassifier
import kotlinx.serialization.json.Json
import java.io.InputStream
import java.io.OutputStream

class NativeMessagingHost(
    private val classifier: MailClassifier,
    private val codec: NativeMessagingCodec = NativeMessagingCodec(),
    private val json: Json =
        Json {
            encodeDefaults = true
            ignoreUnknownKeys = true
            explicitNulls = false
        },
) {
    fun run(
        input: InputStream = System.`in`,
        output: OutputStream = System.out,
    ) {
        while (true) {
            val rawMessage = codec.readMessage(input) ?: return

            try {
                val request = json.decodeFromString<ClassificationRequest>(rawMessage)
                val response = classifier.classify(request)
                codec.writeMessage(output, json.encodeToString(response))
            } catch (exception: Exception) {
                System.err.println("Failed to handle native message: ${exception.message}")
            }
        }
    }
}
