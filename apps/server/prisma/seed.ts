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
  console.log(`Seeded ${manifest.length} stimuli.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
