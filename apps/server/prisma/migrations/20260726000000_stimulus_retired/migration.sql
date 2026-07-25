-- A stimulus dropped from the manifest but still referenced by a past
-- session's report must never be offered to a new session again — its image
-- file may no longer exist. `retired` marks it out of the selectable pool
-- (see stimulusRepo.list/pickRandom) without deleting the row, since deleting
-- it would break the foreign key on that old session/report.
ALTER TABLE "Stimulus" ADD COLUMN "retired" BOOLEAN NOT NULL DEFAULT false;
