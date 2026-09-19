-- Decision 023: rules are not evaluated in V1. Every plan rule is kept as a
-- verbatim note (reason OTHER), then the rule table, its enums and the
-- per-item group memberships go.

-- Keep every rule's text as a note before the table goes.
INSERT INTO "plan_notes" ("id", "planId", "originalText", "reason", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "planId", "originalText", 'OTHER', "createdAt", CURRENT_TIMESTAMP
FROM "plan_rules"
ORDER BY "createdAt", "id";

-- DropForeignKey
ALTER TABLE "plan_rules" DROP CONSTRAINT "plan_rules_planId_fkey";

-- AlterTable
ALTER TABLE "food_items" DROP COLUMN "ruleGroups";

-- DropTable
DROP TABLE "plan_rules";

-- DropEnum
DROP TYPE "RuleKind";

-- DropEnum
DROP TYPE "RulePeriod";

-- DropEnum
DROP TYPE "RuleTracking";
