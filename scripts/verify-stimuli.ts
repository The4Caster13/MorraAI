import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stimuliDir = join(root, 'data', 'stimuli');
const manifestPath = join(stimuliDir, 'manifest.json');

const ALLOWED_LICENSES = /^(CC0|CC BY(-SA)?( \d+\.\d+)?|Public Domain|Placeholder)$/;
const THEMES = ['identites', 'experiences', 'ingeniosite', 'organisation', 'planete'];

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

const errors: string[] = [];

if (!existsSync(manifestPath)) {
  console.error(`manifest.json not found at ${manifestPath} — run generate-placeholder-stimuli.ts first`);
  process.exit(1);
}

const manifest: ManifestEntry[] = JSON.parse(readFileSync(manifestPath, 'utf8'));

if (manifest.length !== 25) errors.push(`Expected 25 entries, found ${manifest.length}`);

const ids = new Set<string>();
const themesSeen = new Set<string>();
for (const e of manifest) {
  if (ids.has(e.id)) errors.push(`Duplicate id: ${e.id}`);
  ids.add(e.id);
  themesSeen.add(e.theme);
  if (!THEMES.includes(e.theme)) errors.push(`${e.id}: unknown theme "${e.theme}"`);
  if (!existsSync(join(stimuliDir, 'images', e.imageFile)))
    errors.push(`${e.id}: image file missing: ${e.imageFile}`);
  for (const field of ['subtopic', 'captionFr', 'culturalLinkFr', 'attribution', 'licenseName', 'sourceUrl'] as const) {
    if (!e[field] || e[field].trim() === '') errors.push(`${e.id}: empty field "${field}"`);
  }
  if (!ALLOWED_LICENSES.test(e.licenseName))
    errors.push(`${e.id}: license "${e.licenseName}" not in allow-list`);
}
for (const t of THEMES) {
  if (!themesSeen.has(t)) errors.push(`Theme "${t}" has no stimuli`);
}

if (errors.length > 0) {
  console.error(`Stimulus verification FAILED (${errors.length} error(s)):`);
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}
console.log(`Stimulus verification passed: ${manifest.length} entries, all ${THEMES.length} themes covered.`);
