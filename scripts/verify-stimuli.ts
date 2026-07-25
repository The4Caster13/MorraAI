import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stimuliDir = join(root, 'data', 'stimuli');
const manifestPath = join(stimuliDir, 'manifest.json');

// "Unverified" is tolerated so development can proceed, but it is a promise to
// come back: these images have no confirmed rights and must not ship publicly.
const ALLOWED_LICENSES = /^(CC0|CC BY(-SA)?( \d+\.\d+)?|Public Domain|Placeholder|Unverified)$/;
/** At least this many stimuli per theme, so no theme is thin or empty. */
const MIN_PER_THEME = 3;
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

if (manifest.length === 0) errors.push('Manifest is empty');

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
const perTheme = new Map<string, number>();
for (const e of manifest) perTheme.set(e.theme, (perTheme.get(e.theme) ?? 0) + 1);
for (const t of THEMES) {
  const n = perTheme.get(t) ?? 0;
  if (n === 0) errors.push(`Theme "${t}" has no stimuli`);
  else if (n < MIN_PER_THEME)
    errors.push(`Theme "${t}" has only ${n} stimulus/stimuli (minimum ${MIN_PER_THEME})`);
}

// An image file nobody references is usually a rename that half-landed.
const referenced = new Set(manifest.map((e) => e.imageFile));
for (const file of readdirSync(join(stimuliDir, 'images'))) {
  if (!referenced.has(file)) errors.push(`Image not referenced by the manifest: ${file}`);
}

if (errors.length > 0) {
  console.error(`Stimulus verification FAILED (${errors.length} error(s)):`);
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}
console.log(
  `Stimulus verification passed: ${manifest.length} entries, all ${THEMES.length} themes covered ` +
    `(${THEMES.map((t) => `${t} ${perTheme.get(t)}`).join(', ')}).`,
);
