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
    fun upsert(
        addressPattern: String,
        targetFolder: String,
    ): RuleEntry {
        val existing =
            dsl
                .select(
                    RULES.ID,
                    RULES.ADDRESS_PATTERN,
                    RULES.TARGET_FOLDER,
                ).from(RULES)
                .where(RULES.ADDRESS_PATTERN.eq(addressPattern))
                .orderBy(RULES.ID.asc())
                .limit(1)
                .fetchOne()

        if (existing == null) {
            return insert(
                addressPattern = addressPattern,
                targetFolder = targetFolder,
            )
        }

        val existingEntry = existing.toRuleEntry()
        if (existingEntry.targetFolder == targetFolder) {
            return existingEntry
        }

        dsl
            .update(RULES)
            .set(RULES.TARGET_FOLDER, targetFolder)
            .where(RULES.ID.eq(existingEntry.id))
            .execute()

        val updated =
            dsl
                .select(
                    RULES.ID,
                    RULES.ADDRESS_PATTERN,
                    RULES.TARGET_FOLDER,
                ).from(RULES)
                .where(RULES.ID.eq(existingEntry.id))
                .fetchOne() ?: error("Updated rule '$addressPattern' could not be reloaded")

        return updated.toRuleEntry()
    }

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
