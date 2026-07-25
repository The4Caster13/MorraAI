-- Parlons initial schema.
--
-- Hand-written to match apps/server/prisma/schema.prisma so that
-- `prisma migrate deploy` works against a fresh Supabase database without an
-- interactive `migrate dev` step. If you change schema.prisma, generate the
-- next migration with `npx prisma migrate dev --name <change>` rather than
-- editing this file.

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stimulus" (
    "id" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "subtopic" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "captionFr" TEXT NOT NULL,
    "culturalLinkFr" TEXT NOT NULL,
    "attribution" TEXT NOT NULL,
    "licenseName" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Stimulus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stimulusId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currentPhase" TEXT,
    "prepSecondsAllotted" INTEGER NOT NULL DEFAULT 900,
    "presentationSecondsCap" INTEGER NOT NULL DEFAULT 240,
    "notepadBullets" JSONB,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptSegment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "speaker" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "startMs" INTEGER NOT NULL,
    "endMs" INTEGER NOT NULL,
    "sttConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranscriptSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudioFile" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "speaker" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'wav',
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AudioFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Score" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "criterionA" INTEGER NOT NULL,
    "criterionB1" INTEGER NOT NULL,
    "criterionB2" INTEGER NOT NULL,
    "criterionC" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "rationaleJson" JSONB NOT NULL,
    "strengthsJson" JSONB NOT NULL,
    "prioritiesJson" JSONB NOT NULL,
    "drillsJson" JSONB NOT NULL,
    "confidenceNote" TEXT,
    "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consentTextVersion" TEXT NOT NULL,
    "recordingConsent" BOOLEAN NOT NULL,
    "dataRetentionAcknowledged" BOOLEAN NOT NULL,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TranscriptSegment_sessionId_phase_idx" ON "TranscriptSegment"("sessionId", "phase");

-- CreateIndex
CREATE UNIQUE INDEX "AudioFile_sessionId_phase_speaker_key" ON "AudioFile"("sessionId", "phase", "speaker");

-- CreateIndex
CREATE UNIQUE INDEX "Score_sessionId_key" ON "Score"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentRecord_sessionId_key" ON "ConsentRecord"("sessionId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_stimulusId_fkey" FOREIGN KEY ("stimulusId") REFERENCES "Stimulus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptSegment" ADD CONSTRAINT "TranscriptSegment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudioFile" ADD CONSTRAINT "AudioFile_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
