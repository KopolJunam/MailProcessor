package ch.kopolinfo.mailprocessor.backend

import ch.kopolinfo.mailprocessor.backend.nativehost.NativeMessagingHost
import ch.kopolinfo.mailprocessor.backend.persistence.DatabaseBootstrap
import ch.kopolinfo.mailprocessor.backend.rules.V1MailClassifier

fun main() {
    val databaseSupport = DatabaseBootstrap.initialize()
    val host = NativeMessagingHost(V1MailClassifier())

    try {
        System.err.println("MailProcessor database ready at ${databaseSupport.config.basePath}")
        host.run()
    } catch (exception: Exception) {
        System.err.println("MailProcessor host terminated with an error: ${exception.message}")
        throw exception
    }
}
