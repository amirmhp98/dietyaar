-- Fail fast when a lock cannot be taken so a rollout never blocks the serving pod (tech spec § 13).
SET lock_timeout = '5s';

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
CREATE TYPE "OnboardingStep" AS ENUM ('AGE', 'SEX', 'HEIGHT', 'WEIGHT', 'TIME_ZONE', 'DISPLAY_NAME', 'PLAN', 'REVIEW', 'READY', 'DONE');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('FEMALE', 'MALE');

-- CreateEnum
CREATE TYPE "UnitSystem" AS ENUM ('METRIC', 'IMPERIAL');

-- CreateEnum
CREATE TYPE "Appearance" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('NONE', 'DRAFT_PENDING', 'ACTIVE');

-- CreateEnum
CREATE TYPE "PlanStructure" AS ENUM ('SAME_EVERY_DAY', 'BY_WEEKDAY', 'TARGETS_ONLY');

-- CreateEnum
CREATE TYPE "DraftKind" AS ENUM ('IMPORT', 'MANUAL', 'EDIT');

-- CreateEnum
CREATE TYPE "TargetNutrient" AS ENUM ('ENERGY_KCAL', 'PROTEIN_G', 'CARB_G', 'FAT_G', 'FIBER_G', 'SODIUM_MG');

-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('RANGE', 'MINIMUM', 'MAXIMUM', 'DESIRED', 'APPROXIMATE');

-- CreateEnum
CREATE TYPE "TargetSource" AS ENUM ('EXPLICIT', 'ESTIMATED', 'SUM_OF_MEALS');

-- CreateEnum
CREATE TYPE "RuleKind" AS ENUM ('SERVING_COUNT', 'DISTINCT_GROUPS', 'NAMED_WEEKDAY_FOOD', 'EXCLUSION', 'TIMING_WINDOW', 'INSTRUCTION');

-- CreateEnum
CREATE TYPE "RuleTracking" AS ENUM ('TRACK', 'NOTE', 'IGNORE');

-- CreateEnum
CREATE TYPE "RulePeriod" AS ENUM ('DAY', 'WEEK');

-- CreateEnum
CREATE TYPE "NoteReason" AS ENUM ('TRAINING_CONDITIONAL', 'EXERCISE', 'FASTING', 'DAY_TYPE', 'UNSUPPORTED_SCHEDULE', 'OTHER');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MealInputKind" AS ENUM ('TEXT', 'PHOTO', 'PHOTO_TEXT', 'RECENT', 'PLANNED', 'MANUAL');

-- CreateEnum
CREATE TYPE "FoodCategory" AS ENUM ('OIL', 'BREAD', 'RICE', 'POTATO', 'NUTS', 'DAIRY', 'MEAT', 'VEGETABLE', 'HERB', 'CONDIMENT', 'FRUIT', 'OTHER');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('STAGED', 'ATTACHED', 'REMOVED');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('NONE', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('GENERATING', 'READY');

-- CreateEnum
CREATE TYPE "FallbackState" AS ENUM ('COMPLETE', 'UNCHECKED', 'NO_RECORDS', 'FIRST_DAY', 'NO_PLAN', 'PROVIDER_FAILURE');

-- CreateEnum
CREATE TYPE "AiCallKind" AS ENUM ('PLAN_IMPORT', 'PLAN_BASELINE', 'MEAL_TEXT', 'MEAL_PHOTO', 'REFLECTION');

-- CreateEnum
CREATE TYPE "AiOutcome" AS ENUM ('PENDING', 'OK', 'INVALID_JSON', 'SCHEMA_REJECTED', 'TIMEOUT', 'PROVIDER_ERROR', 'RATE_LIMITED');

-- AlterTable
-- decision: 016 — boilerplate timestamp(3) columns become timestamptz(3). The existing
-- values were written as UTC instants, so the conversion is explicit and does not depend
-- on the session time zone.
ALTER TABLE "sessions"
  ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMPTZ(3) USING "expiresAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

-- AlterTable
-- decision: 016 (timestamptz), 008 (fullName optional, usernameLower for case-insensitive uniqueness)
ALTER TABLE "users" ADD COLUMN     "deletionRequestedAt" TIMESTAMPTZ(3),
ADD COLUMN     "deletionScheduledFor" TIMESTAMPTZ(3),
ADD COLUMN     "onboardingStep" "OnboardingStep" NOT NULL DEFAULT 'AGE',
ADD COLUMN     "usernameLower" CITEXT,
ALTER COLUMN "fullName" DROP NOT NULL,
ALTER COLUMN "lastLoginAt" SET DATA TYPE TIMESTAMPTZ(3) USING "lastLoginAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- Backfill existing accounts, then tighten.
UPDATE "users" SET "usernameLower" = lower(trim("username")) WHERE "usernameLower" IS NULL;
ALTER TABLE "users" ALTER COLUMN "usernameLower" SET NOT NULL;

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ageYears" INTEGER,
    "sex" "Sex",
    "heightCm" DECIMAL(10,2),
    "weightKg" DECIMAL(10,2),
    "weightMeasuredAt" VARCHAR(10),
    "timeZone" TEXT,
    "unitSystem" "UnitSystem" NOT NULL DEFAULT 'METRIC',
    "weekStart" INTEGER,
    "appearance" "Appearance" NOT NULL DEFAULT 'SYSTEM',
    "displayName" TEXT,
    "goal" TEXT,
    "restrictions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "restrictionsOriginal" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aiNoticePlanShownAt" TIMESTAMPTZ(3),
    "aiNoticeMealTextShownAt" TIMESTAMPTZ(3),
    "aiNoticePhotoShownAt" TIMESTAMPTZ(3),
    "lastSeenDeviceTimeZone" TEXT,
    "timeZoneHintDismissedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'NONE',
    "structure" "PlanStructure",
    "name" TEXT,
    "sourceNote" TEXT,
    "sourceLanguage" TEXT,
    "sourceText" TEXT,
    "draftSourceText" TEXT,
    "draftId" TEXT,
    "draftKind" "DraftKind",
    "draftJson" JSONB,
    "confirmedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_slots" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "englishLabel" TEXT NOT NULL,
    "timeStart" VARCHAR(5),
    "timeEnd" VARCHAR(5),
    "sourceExcerpt" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plan_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_options" (
    "id" TEXT NOT NULL,
    "planSlotId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plan_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_items" (
    "id" TEXT NOT NULL,
    "planOptionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "englishLabel" TEXT NOT NULL,
    "quantity" DECIMAL(10,2),
    "unit" TEXT,
    "quantityAssumed" BOOLEAN NOT NULL DEFAULT false,
    "assumedDefaultKey" TEXT,
    "preparationNote" TEXT,
    "alternatives" JSONB NOT NULL DEFAULT '[]',
    "category" "FoodCategory" NOT NULL DEFAULT 'OTHER',
    "nutrition" JSONB,
    "sourceExcerpt" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_targets" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "planSlotId" TEXT,
    "weekday" INTEGER,
    "nutrient" "TargetNutrient" NOT NULL,
    "type" "TargetType" NOT NULL,
    "low" DECIMAL(10,2),
    "high" DECIMAL(10,2),
    "source" "TargetSource" NOT NULL,
    "sourceExcerpt" TEXT,
    "scopeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plan_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_rules" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "kind" "RuleKind" NOT NULL,
    "tracking" "RuleTracking" NOT NULL DEFAULT 'NOTE',
    "period" "RulePeriod",
    "definition" JSONB NOT NULL DEFAULT '{}',
    "originalText" TEXT NOT NULL,
    "sourceExcerpt" TEXT NOT NULL DEFAULT '',
    "isConflicting" BOOLEAN NOT NULL DEFAULT false,
    "unsupportedReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plan_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_notes" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "originalText" TEXT NOT NULL,
    "reason" "NoteReason" NOT NULL DEFAULT 'OTHER',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plan_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_import_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "draftId" TEXT NOT NULL,
    "heartbeatAt" TIMESTAMPTZ(3),
    "startedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "errorCategory" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plan_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "day_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDate" VARCHAR(10) NOT NULL,
    "timeZone" TEXT NOT NULL,
    "logComplete" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "day_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "day_skipped_slots" (
    "id" TEXT NOT NULL,
    "dayRecordId" TEXT NOT NULL,
    "planSlotId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "day_skipped_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayRecordId" TEXT NOT NULL,
    "consumedLocalTime" VARCHAR(5),
    "inputKind" "MealInputKind" NOT NULL,
    "originalText" TEXT,
    "notes" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "copiedFromMealId" TEXT,
    "clientRequestId" TEXT NOT NULL,
    "planSlotId" TEXT,
    "planOptionId" TEXT,
    "linkConfirmedByUser" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_items" (
    "id" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "englishLabel" TEXT NOT NULL,
    "quantity" DECIMAL(10,2),
    "unit" TEXT,
    "quantityUnknown" BOOLEAN NOT NULL DEFAULT false,
    "quantityAssumed" BOOLEAN NOT NULL DEFAULT false,
    "preparation" TEXT,
    "category" "FoodCategory" NOT NULL DEFAULT 'OTHER',
    "alternatives" JSONB NOT NULL DEFAULT '[]',
    "matchedPlanItemId" TEXT,
    "isAddedItem" BOOLEAN NOT NULL DEFAULT false,
    "restrictionHit" TEXT,
    "ruleGroups" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nutrition" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "food_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploads" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mealId" TEXT,
    "position" INTEGER,
    "storageKey" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'STAGED',
    "expiresAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_drafts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientRequestId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "state" JSONB NOT NULL,
    "analysisRunId" TEXT,
    "analysisStartedRevision" INTEGER,
    "analysisInputHash" TEXT,
    "analysisResult" JSONB,
    "analysisStatus" "AnalysisStatus" NOT NULL DEFAULT 'NONE',
    "analysisFailureReason" TEXT,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "meal_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "morning_messages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDate" VARCHAR(10) NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'GENERATING',
    "paragraph" TEXT,
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "fallbackState" "FallbackState",
    "factsSnapshot" JSONB NOT NULL DEFAULT '[]',
    "factsHash" TEXT NOT NULL DEFAULT '',
    "usedFactIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "generatedAt" TIMESTAMPTZ(3),
    "claimedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerModel" TEXT,
    "stale" BOOLEAN NOT NULL DEFAULT false,
    "collapsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "morning_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_calls" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "kind" "AiCallKind" NOT NULL,
    "localDate" VARCHAR(10),
    "providerModel" TEXT,
    "inputRevision" INTEGER,
    "durationMs" INTEGER,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "outcome" "AiOutcome" NOT NULL DEFAULT 'PENDING',
    "attemptsJson" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ai_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_data_cache" (
    "id" TEXT NOT NULL,
    "queryKey" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "fetchedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_data_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_locks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "holder" TEXT,
    "lockedUntil" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "job_locks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_userId_key" ON "profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "plans_userId_key" ON "plans"("userId");

-- CreateIndex
CREATE INDEX "plan_slots_planId_idx" ON "plan_slots"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "plan_slots_planId_weekday_position_key" ON "plan_slots"("planId", "weekday", "position");

-- CreateIndex
CREATE INDEX "plan_options_planSlotId_idx" ON "plan_options"("planSlotId");

-- CreateIndex
CREATE INDEX "plan_items_planOptionId_idx" ON "plan_items"("planOptionId");

-- CreateIndex
CREATE INDEX "plan_targets_planSlotId_idx" ON "plan_targets"("planSlotId");

-- CreateIndex
CREATE UNIQUE INDEX "plan_targets_planId_scopeKey_key" ON "plan_targets"("planId", "scopeKey");

-- CreateIndex
CREATE INDEX "plan_rules_planId_idx" ON "plan_rules"("planId");

-- CreateIndex
CREATE INDEX "plan_notes_planId_idx" ON "plan_notes"("planId");

-- CreateIndex
CREATE INDEX "plan_import_jobs_status_heartbeatAt_idx" ON "plan_import_jobs"("status", "heartbeatAt");

-- CreateIndex
CREATE INDEX "plan_import_jobs_userId_createdAt_idx" ON "plan_import_jobs"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "day_records_userId_localDate_key" ON "day_records"("userId", "localDate");

-- CreateIndex
CREATE INDEX "day_skipped_slots_planSlotId_idx" ON "day_skipped_slots"("planSlotId");

-- CreateIndex
CREATE UNIQUE INDEX "day_skipped_slots_dayRecordId_planSlotId_key" ON "day_skipped_slots"("dayRecordId", "planSlotId");

-- CreateIndex
CREATE UNIQUE INDEX "meals_clientRequestId_key" ON "meals"("clientRequestId");

-- CreateIndex
CREATE INDEX "meals_userId_dayRecordId_idx" ON "meals"("userId", "dayRecordId");

-- CreateIndex
CREATE INDEX "meals_userId_createdAt_idx" ON "meals"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "meals_planSlotId_idx" ON "meals"("planSlotId");

-- CreateIndex
CREATE INDEX "meals_planOptionId_idx" ON "meals"("planOptionId");

-- CreateIndex
CREATE INDEX "meals_dayRecordId_idx" ON "meals"("dayRecordId");

-- CreateIndex
CREATE INDEX "food_items_mealId_idx" ON "food_items"("mealId");

-- CreateIndex
CREATE INDEX "food_items_matchedPlanItemId_idx" ON "food_items"("matchedPlanItemId");

-- CreateIndex
CREATE INDEX "uploads_userId_idx" ON "uploads"("userId");

-- CreateIndex
CREATE INDEX "uploads_mealId_idx" ON "uploads"("mealId");

-- CreateIndex
CREATE INDEX "uploads_status_expiresAt_idx" ON "uploads"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "meal_drafts_clientRequestId_key" ON "meal_drafts"("clientRequestId");

-- CreateIndex
CREATE INDEX "meal_drafts_userId_idx" ON "meal_drafts"("userId");

-- CreateIndex
CREATE INDEX "meal_drafts_expiresAt_idx" ON "meal_drafts"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "morning_messages_userId_localDate_key" ON "morning_messages"("userId", "localDate");

-- CreateIndex
CREATE INDEX "ai_calls_userId_kind_createdAt_idx" ON "ai_calls"("userId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "ai_calls_createdAt_idx" ON "ai_calls"("createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_name_createdAt_idx" ON "analytics_events"("name", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_createdAt_idx" ON "analytics_events"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "food_data_cache_queryKey_key" ON "food_data_cache"("queryKey");

-- CreateIndex
CREATE INDEX "food_data_cache_fetchedAt_idx" ON "food_data_cache"("fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "job_locks_name_key" ON "job_locks"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_usernameLower_key" ON "users"("usernameLower");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_slots" ADD CONSTRAINT "plan_slots_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_options" ADD CONSTRAINT "plan_options_planSlotId_fkey" FOREIGN KEY ("planSlotId") REFERENCES "plan_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_planOptionId_fkey" FOREIGN KEY ("planOptionId") REFERENCES "plan_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_targets" ADD CONSTRAINT "plan_targets_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_targets" ADD CONSTRAINT "plan_targets_planSlotId_fkey" FOREIGN KEY ("planSlotId") REFERENCES "plan_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_rules" ADD CONSTRAINT "plan_rules_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_notes" ADD CONSTRAINT "plan_notes_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_import_jobs" ADD CONSTRAINT "plan_import_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "day_records" ADD CONSTRAINT "day_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "day_skipped_slots" ADD CONSTRAINT "day_skipped_slots_dayRecordId_fkey" FOREIGN KEY ("dayRecordId") REFERENCES "day_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "day_skipped_slots" ADD CONSTRAINT "day_skipped_slots_planSlotId_fkey" FOREIGN KEY ("planSlotId") REFERENCES "plan_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meals" ADD CONSTRAINT "meals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meals" ADD CONSTRAINT "meals_dayRecordId_fkey" FOREIGN KEY ("dayRecordId") REFERENCES "day_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meals" ADD CONSTRAINT "meals_planSlotId_fkey" FOREIGN KEY ("planSlotId") REFERENCES "plan_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meals" ADD CONSTRAINT "meals_planOptionId_fkey" FOREIGN KEY ("planOptionId") REFERENCES "plan_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_items" ADD CONSTRAINT "food_items_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "meals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_items" ADD CONSTRAINT "food_items_matchedPlanItemId_fkey" FOREIGN KEY ("matchedPlanItemId") REFERENCES "plan_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "meals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_drafts" ADD CONSTRAINT "meal_drafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "morning_messages" ADD CONSTRAINT "morning_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_calls" ADD CONSTRAINT "ai_calls_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Partial index Prisma cannot express: accounts waiting to be purged.
CREATE INDEX "users_deletionScheduledFor_idx" ON "users"("deletionScheduledFor") WHERE "deletionScheduledFor" IS NOT NULL;
