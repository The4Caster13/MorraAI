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

  // Remove stimuli that are no longer in the manifest. Without this, an entry
  // dropped or renamed upstream stays in the database and keeps being handed
  // to students — pointing at an image file that no longer exists. Rows still
  // referenced by a past session are kept, since deleting one would take that
  // student's report with it.
  const ids = manifest.map((e) => e.id);
  const stale = await prisma.stimulus.findMany({
    where: { id: { notIn: ids } },
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
    console.warn(
      `${inUse.length} outdated stimulus/stimuli kept because past sessions reference them: ` +
        `${inUse.join(', ')}. Their image files may no longer exist.`,
    );
  }

  console.log(`Seeded ${manifest.length} stimuli.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
