package ch.kopolinfo.mailprocessor.backend.persistence

import ch.kopolinfo.mailprocessor.backend.jooq.tables.references.RULES
import org.jooq.DSLContext

data class RuleEntry(
    val id: Long,
    val addressPattern: String,
    val targetFolder: String,
)

class RulesRepository(
    private val dsl: DSLContext,
) {
    fun insert(
        addressPattern: String,
        targetFolder: String,
    ): RuleEntry {
        val record =
            dsl
                .insertInto(RULES)
                .columns(RULES.ADDRESS_PATTERN, RULES.TARGET_FOLDER)
                .values(addressPattern, targetFolder)
                .returning(RULES.ID, RULES.ADDRESS_PATTERN, RULES.TARGET_FOLDER)
                .fetchOne() ?: error("Insert into rules did not return a record")

        return record.toRuleEntry()
    }

    fun findAll(): List<RuleEntry> =
        dsl
            .select(
                RULES.ID,
                RULES.ADDRESS_PATTERN,
                RULES.TARGET_FOLDER,
            ).from(RULES)
            .orderBy(RULES.ID.asc())
            .fetch { it.toRuleEntry() }

    private fun org.jooq.Record.toRuleEntry(): RuleEntry =
        RuleEntry(
            id = get(RULES.ID)?.toLong() ?: error("Rule id must not be null"),
            addressPattern = get(RULES.ADDRESS_PATTERN) ?: error("address_pattern must not be null"),
            targetFolder = get(RULES.TARGET_FOLDER) ?: error("target_folder must not be null"),
        )
}
