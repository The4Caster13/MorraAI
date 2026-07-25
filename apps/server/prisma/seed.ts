import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { loadEnvFiles } from '../src/config/loadEnvFiles.js';

// This script is run directly by tsx, not by the Prisma CLI, so nothing else
// populates DATABASE_URL for it.
loadEnvFiles();

const prisma = new PrismaClient();
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const manifestPath = join(root, 'data', 'stimuli', 'manifest.json');

type ManifestEntry = {
  id: string;
  theme: string;
  subtopic: string;
  imageFile: string;
  captionFr: string;
  culturalLinkFr: string;
  attribution: string;
  licenseName: string;
  sourceUrl: string;
};

async function main() {
  const manifest: ManifestEntry[] = JSON.parse(readFileSync(manifestPath, 'utf8'));
  for (const e of manifest) {
    await prisma.stimulus.upsert({
      where: { id: e.id },
      update: {
        theme: e.theme,
        subtopic: e.subtopic,
        imagePath: e.imageFile,
        captionFr: e.captionFr,
        culturalLinkFr: e.culturalLinkFr,
        attribution: e.attribution,
        licenseName: e.licenseName,
        sourceUrl: e.sourceUrl,
        // A stimulus can reappear in a later manifest revision after being
        // dropped from an earlier one — un-retire it if so.
        retired: false,
      },
      create: {
        id: e.id,
        theme: e.theme,
        subtopic: e.subtopic,
        imagePath: e.imageFile,
        captionFr: e.captionFr,
        culturalLinkFr: e.culturalLinkFr,
        attribution: e.attribution,
        licenseName: e.licenseName,
        sourceUrl: e.sourceUrl,
      },
    });
  }

  // Retire stimuli that are no longer in the manifest, rather than deleting
  // them outright. A dropped or renamed entry pointing at an image file that
  // no longer exists must never be offered to a new session or listed
  // publicly again — but a past session's report still has a foreign key to
  // this row, so the row itself has to survive.
  const ids = manifest.map((e) => e.id);
  const stale = await prisma.stimulus.findMany({
    where: { id: { notIn: ids }, retired: false },
    select: { id: true },
  });
  const referencedRows = await prisma.session.findMany({ select: { stimulusId: true } });
  const referenced = new Set(referencedRows.map((s) => s.stimulusId));

  const orphaned = stale.map((s) => s.id).filter((id) => !referenced.has(id));
  const inUse = stale.map((s) => s.id).filter((id) => referenced.has(id));

  if (orphaned.length > 0) {
    await prisma.stimulus.deleteMany({ where: { id: { in: orphaned } } });
    console.log(`Removed ${orphaned.length} stimulus/stimuli no longer in the manifest.`);
  }
  if (inUse.length > 0) {
    await prisma.stimulus.updateMany({ where: { id: { in: inUse } }, data: { retired: true } });
    console.warn(
      `${inUse.length} outdated stimulus/stimuli retired (kept for past sessions, no longer ` +
        `offered to new ones): ${inUse.join(', ')}.`,
    );
  }

  console.log(`Seeded ${manifest.length} active stimuli.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
