-- Reflection: static paragraphs for the empty data states (no provider call) and "Got it".
-- `collapsed` becomes `acknowledgedAt`; a collapsed card counts as acknowledged when it was last touched.
ALTER TABLE "morning_messages"
  ADD COLUMN "isStatic" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "acknowledgedAt" TIMESTAMPTZ(3);

UPDATE "morning_messages" SET "acknowledgedAt" = "updatedAt" WHERE "collapsed" = true;

ALTER TABLE "morning_messages" DROP COLUMN "collapsed";
