package ch.kopolinfo.mailprocessor.backend

import ch.kopolinfo.mailprocessor.backend.nativehost.NativeMessagingHost
import ch.kopolinfo.mailprocessor.backend.persistence.DatabaseBootstrap
import ch.kopolinfo.mailprocessor.backend.persistence.RulesRepository
import ch.kopolinfo.mailprocessor.backend.rules.DatabaseMailClassifier
import ch.kopolinfo.mailprocessor.backend.rules.LearningEngine
import ch.kopolinfo.mailprocessor.backend.service.MailProcessorService

fun main() {
    val databaseSupport = DatabaseBootstrap.initialize()
    val rulesRepository = RulesRepository(databaseSupport.dsl)
    val service =
        MailProcessorService(
            classifier = DatabaseMailClassifier(rulesRepository),
            learningEngine = LearningEngine(rulesRepository),
        )
    val host = NativeMessagingHost(service)

    try {
        System.err.println("MailProcessor database ready at ${databaseSupport.config.basePath}")
        host.run()
    } catch (exception: Exception) {
        System.err.println("MailProcessor host terminated with an error: ${exception.message}")
        throw exception
    }
}
