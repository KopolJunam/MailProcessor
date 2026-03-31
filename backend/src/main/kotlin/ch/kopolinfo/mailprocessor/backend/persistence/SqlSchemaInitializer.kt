package ch.kopolinfo.mailprocessor.backend.persistence

import org.jooq.DSLContext
import java.sql.Connection

class SqlSchemaInitializer(
    private val resourcePath: String = "db/schema.sql",
) {
    fun ensureExists(dsl: DSLContext) {
        val script =
            javaClass.classLoader
                .getResourceAsStream(resourcePath)
                ?.bufferedReader(Charsets.UTF_8)
                ?.use { it.readText() }
                ?: error("Schema resource '$resourcePath' was not found")

        val statements =
            script
                .lineSequence()
                .map { it.trim() }
                .filter { it.isNotEmpty() && !it.startsWith("--") }
                .joinToString("\n")
                .split(";")
                .map { it.trim() }
                .filter { it.isNotEmpty() }

        dsl.connection { connection ->
            connection.runStatements(statements)
        }
    }

    private fun Connection.runStatements(statements: List<String>) {
        createStatement().use { statement ->
            for (sql in statements) {
                statement.execute(sql)
            }
        }
    }
}
