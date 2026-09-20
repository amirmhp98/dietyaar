-- Time zone fixed to Asia/Dubai (decision 022): the per-user zone, the device-zone hint and the
-- onboarding time-zone step go. Day rows keep the zone they were computed in.
SET lock_timeout = '5s';

-- A user parked on the removed step resumes at the step that followed it.
UPDATE "users" SET "onboardingStep" = 'DISPLAY_NAME' WHERE "onboardingStep" = 'TIME_ZONE';

-- AlterEnum
BEGIN;
CREATE TYPE "OnboardingStep_new" AS ENUM ('AGE', 'SEX', 'HEIGHT', 'WEIGHT', 'DISPLAY_NAME', 'PLAN', 'REVIEW', 'READY', 'DONE');
ALTER TABLE "users" ALTER COLUMN "onboardingStep" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "onboardingStep" TYPE "OnboardingStep_new" USING ("onboardingStep"::text::"OnboardingStep_new");
ALTER TYPE "OnboardingStep" RENAME TO "OnboardingStep_old";
ALTER TYPE "OnboardingStep_new" RENAME TO "OnboardingStep";
DROP TYPE "OnboardingStep_old";
ALTER TABLE "users" ALTER COLUMN "onboardingStep" SET DEFAULT 'AGE';
COMMIT;

-- AlterTable
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "lastSeenDeviceTimeZone",
DROP COLUMN IF EXISTS "timeZone",
DROP COLUMN IF EXISTS "timeZoneHintDismissedAt";
