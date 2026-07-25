-- Exam format is 10 minutes preparation, a 10 minute presentation, then 5
-- minutes of questioning. The presentation cap moves from 4 to 10 minutes.
--
-- Only affects rows inserted without an explicit value; the application always
-- passes one, so this keeps the schema honest rather than changing behaviour.
ALTER TABLE "Session" ALTER COLUMN "presentationSecondsCap" SET DEFAULT 600;
