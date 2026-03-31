package ch.kopolinfo.mailprocessor.backend

import ch.kopolinfo.mailprocessor.backend.nativehost.NativeMessagingHost
import ch.kopolinfo.mailprocessor.backend.rules.V1MailClassifier

fun main() {
    val host = NativeMessagingHost(V1MailClassifier())

    try {
        host.run()
    } catch (exception: Exception) {
        System.err.println("MailProcessor host terminated with an error: ${exception.message}")
        throw exception
    }
}
