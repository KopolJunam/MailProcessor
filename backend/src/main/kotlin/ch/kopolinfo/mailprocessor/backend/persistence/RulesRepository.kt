package ch.kopolinfo.mailprocessor.backend.persistence

import ch.kopolinfo.mailprocessor.backend.jooq.tables.references.RULES
import org.jooq.DSLContext

data class RuleEntry(
    val id: Long,
    val addressPattern: String,
    val subjectRegex: String?,
    val targetFolder: String,
)

class RulesRepository(
    private val dsl: DSLContext,
) {
    fun upsert(
        addressPattern: String,
        targetFolder: String,
        subjectRegex: String? = null,
    ): RuleEntry {
        val normalizedTargetFolder = normalizeTargetFolder(targetFolder)
        val existing =
            dsl
                .select(
                    RULES.ID,
                    RULES.ADDRESS_PATTERN,
                    RULES.SUBJECT_REGEX,
                    RULES.TARGET_FOLDER,
                ).from(RULES)
                .where(RULES.ADDRESS_PATTERN.eq(addressPattern))
                .and(
                    if (subjectRegex == null) {
                        RULES.SUBJECT_REGEX.isNull
                    } else {
                        RULES.SUBJECT_REGEX.eq(subjectRegex)
                    },
                ).orderBy(RULES.ID.asc())
                .limit(1)
                .fetchOne()

        if (existing == null) {
            return insert(
                addressPattern = addressPattern,
                subjectRegex = subjectRegex,
                targetFolder = normalizedTargetFolder,
            )
        }

        val existingEntry = existing.toRuleEntry()
        if (existingEntry.targetFolder == normalizedTargetFolder) {
            return existingEntry
        }

        dsl
            .update(RULES)
            .set(RULES.TARGET_FOLDER, normalizedTargetFolder)
            .where(RULES.ID.eq(existingEntry.id))
            .execute()

        val updated =
            dsl
                .select(
                    RULES.ID,
                    RULES.ADDRESS_PATTERN,
                    RULES.SUBJECT_REGEX,
                    RULES.TARGET_FOLDER,
                ).from(RULES)
                .where(RULES.ID.eq(existingEntry.id))
                .fetchOne() ?: error("Updated rule '$addressPattern' could not be reloaded")

        return updated.toRuleEntry()
    }

    fun insert(
        addressPattern: String,
        targetFolder: String,
        subjectRegex: String? = null,
    ): RuleEntry {
        val normalizedTargetFolder = normalizeTargetFolder(targetFolder)
        val record =
            dsl
                .insertInto(RULES)
                .columns(RULES.ADDRESS_PATTERN, RULES.SUBJECT_REGEX, RULES.TARGET_FOLDER)
                .values(addressPattern, subjectRegex, normalizedTargetFolder)
                .returning(RULES.ID, RULES.ADDRESS_PATTERN, RULES.SUBJECT_REGEX, RULES.TARGET_FOLDER)
                .fetchOne() ?: error("Insert into rules did not return a record")

        return record.toRuleEntry()
    }

    fun findAll(): List<RuleEntry> =
        dsl
            .select(
                RULES.ID,
                RULES.ADDRESS_PATTERN,
                RULES.SUBJECT_REGEX,
                RULES.TARGET_FOLDER,
            ).from(RULES)
            .orderBy(RULES.ID.asc())
            .fetch { it.toRuleEntry() }

    private fun org.jooq.Record.toRuleEntry(): RuleEntry =
        RuleEntry(
            id = get(RULES.ID) ?: error("Rule id must not be null"),
            addressPattern = get(RULES.ADDRESS_PATTERN) ?: error("address_pattern must not be null"),
            subjectRegex = get(RULES.SUBJECT_REGEX),
            targetFolder = get(RULES.TARGET_FOLDER) ?: error("target_folder must not be null"),
        )

    private fun normalizeTargetFolder(targetFolder: String): String {
        val trimmedTargetFolder = targetFolder.trim()
        require(trimmedTargetFolder.isNotEmpty()) { "targetFolder must not be blank" }
        return if (trimmedTargetFolder.startsWith("/")) {
            trimmedTargetFolder
        } else {
            "/$trimmedTargetFolder"
        }
    }
}
