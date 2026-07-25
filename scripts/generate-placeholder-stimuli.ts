import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'data', 'stimuli');
const imgDir = join(outDir, 'images');
mkdirSync(imgDir, { recursive: true });

type Entry = {
  id: string;
  theme: string;
  themeLabel: string;
  color: string;
  subtopic: string;
  subtopicLabel: string;
  captionFr: string;
  culturalLinkFr: string;
};

const themes: Array<{
  theme: string;
  themeLabel: string;
  color: string;
  subs: Array<{ slug: string; label: string; captionFr: string; culturalLinkFr: string }>;
}> = [
  {
    theme: 'identites',
    themeLabel: 'Identités',
    color: '#7c3aed',
    subs: [
      { slug: 'vie-scolaire', label: 'La vie scolaire', captionFr: 'Des lycéens dans une salle de classe en France.', culturalLinkFr: "Le système scolaire français : le lycée, le baccalauréat et la vie d'élève." },
      { slug: 'reunion-famille', label: 'Une réunion de famille', captionFr: 'Une famille réunie autour d’un repas dominical.', culturalLinkFr: 'Le repas de famille, tradition centrale de la vie sociale francophone.' },
      { slug: 'equipe-sportive', label: 'Une équipe sportive', captionFr: 'De jeunes joueurs célèbrent une victoire ensemble.', culturalLinkFr: "Le sport et l'identité collective : clubs locaux et équipes nationales francophones." },
      { slug: 'mode-expression', label: 'La mode et l’expression de soi', captionFr: 'Des jeunes exprimant leur style vestimentaire dans la rue.', culturalLinkFr: 'Paris, capitale de la mode, et la culture du style chez les jeunes francophones.' },
      { slug: 'passage-adulte', label: 'Le passage à l’âge adulte', captionFr: 'Une remise de diplômes marquant une étape importante.', culturalLinkFr: 'Les rites de passage dans les cultures francophones : bac, permis, majorité.' },
    ],
  },
  {
    theme: 'experiences',
    themeLabel: 'Expériences',
    color: '#0891b2',
    subs: [
      { slug: 'voyage-tourisme', label: 'Le voyage et le tourisme', captionFr: 'Des voyageurs découvrent une ville francophone historique.', culturalLinkFr: 'Le tourisme au Québec, au Maroc et en France : patrimoine et découverte.' },
      { slug: 'festival', label: 'Un festival', captionFr: 'Une foule assiste à un festival de musique en plein air.', culturalLinkFr: 'Les festivals francophones : Cannes, les Francofolies, le Festival de jazz de Montréal.' },
      { slug: 'rite-passage', label: 'Un rite de passage', captionFr: 'Une cérémonie traditionnelle réunissant plusieurs générations.', culturalLinkFr: 'Cérémonies et traditions dans le monde francophone, de Dakar à Bruxelles.' },
      { slug: 'lieu-memorable', label: 'Un lieu mémorable', captionFr: 'Un paysage marquant gravé dans la mémoire d’un visiteur.', culturalLinkFr: 'Les lieux de mémoire francophones : monuments, places et paysages emblématiques.' },
      { slug: 'migration', label: 'La migration', captionFr: 'Une famille arrive dans un nouveau pays avec ses valises.', culturalLinkFr: "L'immigration et la diversité culturelle en France, en Belgique et au Canada." },
    ],
  },
  {
    theme: 'ingeniosite',
    themeLabel: 'Ingéniosité humaine',
    color: '#ea580c',
    subs: [
      { slug: 'technologie-quotidien', label: 'La technologie du quotidien', captionFr: 'Des jeunes utilisent leurs smartphones dans un café.', culturalLinkFr: 'La French Tech et la place du numérique dans la vie quotidienne francophone.' },
      { slug: 'transport', label: 'Les transports', captionFr: 'Un TGV en gare, symbole de la mobilité moderne.', culturalLinkFr: 'Le TGV et les transports publics, fiertés technologiques françaises.' },
      { slug: 'architecture', label: "L'architecture", captionFr: 'Un bâtiment moderne contrastant avec un quartier historique.', culturalLinkFr: "L'architecture francophone : de Haussmann à la pyramide du Louvre." },
      { slug: 'artisanat-art', label: "L'artisanat et l'art", captionFr: 'Un artisan travaille dans son atelier traditionnel.', culturalLinkFr: "Les métiers d'art et le patrimoine artisanal dans le monde francophone." },
      { slug: 'invention-scientifique', label: 'Une invention scientifique', captionFr: 'Des chercheurs travaillent dans un laboratoire.', culturalLinkFr: 'Les grandes figures scientifiques francophones : Pasteur, Curie, et la recherche actuelle.' },
    ],
  },
  {
    theme: 'organisation',
    themeLabel: 'Organisation sociale',
    color: '#16a34a',
    subs: [
      { slug: 'marche-urbain', label: 'Un marché urbain', captionFr: 'Un marché de quartier animé un samedi matin.', culturalLinkFr: 'Les marchés, lieux de vie sociale en France et au Maghreb.' },
      { slug: 'transport-public', label: 'Les transports publics', captionFr: 'Des passagers dans le métro aux heures de pointe.', culturalLinkFr: 'Le métro parisien et les transports urbains francophones.' },
      { slug: 'lieu-travail', label: 'Le lieu de travail', captionFr: 'Des collègues collaborent dans un bureau moderne.', culturalLinkFr: 'Le monde du travail en France : les 35 heures, la pause déjeuner, le télétravail.' },
      { slug: 'structure-familiale', label: 'La structure familiale', captionFr: 'Trois générations d’une famille sous le même toit.', culturalLinkFr: "L'évolution de la famille dans les sociétés francophones." },
      { slug: 'benevolat', label: 'Le bénévolat', captionFr: 'Des bénévoles distribuent des repas aux personnes démunies.', culturalLinkFr: 'Les Restos du Cœur et la culture associative française.' },
    ],
  },
  {
    theme: 'planete',
    themeLabel: 'Partage de la planète',
    color: '#0d9488',
    subs: [
      { slug: 'climat-environnement', label: 'Le climat et l’environnement', captionFr: 'Une manifestation pour le climat rassemble des jeunes.', culturalLinkFr: "L'Accord de Paris et l'engagement climatique de la jeunesse francophone." },
      { slug: 'urbain-rural', label: 'Ville et campagne', captionFr: 'Un contraste entre un champ cultivé et une ville en expansion.', culturalLinkFr: "L'exode rural et la revitalisation des campagnes françaises." },
      { slug: 'conservation-faune', label: 'La conservation de la faune', captionFr: 'Un animal sauvage dans une réserve naturelle protégée.', culturalLinkFr: 'Les parcs nationaux dans les pays francophones, de la Vanoise à la Réunion.' },
      { slug: 'acces-eau', label: "L'accès à l'eau", captionFr: 'Un puits fournit de l’eau potable à un village.', culturalLinkFr: "L'accès à l'eau potable, enjeu majeur en Afrique francophone." },
      { slug: 'recyclage', label: 'Le recyclage', captionFr: 'Des habitants trient leurs déchets dans des bacs colorés.', culturalLinkFr: 'Le tri sélectif et l’économie circulaire en France et en Belgique.' },
    ],
  },
];

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function svgFor(e: Entry): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" role="img" aria-label="${esc(e.subtopicLabel)}">
  <rect width="800" height="600" fill="${e.color}"/>
  <rect x="24" y="24" width="752" height="552" fill="none" stroke="#ffffff" stroke-width="3" stroke-dasharray="14 10" opacity="0.7"/>
  <text x="400" y="230" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="#ffffff" opacity="0.9">${esc(e.themeLabel)}</text>
  <text x="400" y="300" text-anchor="middle" font-family="Georgia, serif" font-size="42" font-weight="bold" fill="#ffffff">${esc(e.subtopicLabel)}</text>
  <text x="400" y="420" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#ffffff" opacity="0.85">PLACEHOLDER — À REMPLACER</text>
  <text x="400" y="460" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="18" fill="#ffffff" opacity="0.7">Remplacez cette image par une photo sous licence.</text>
</svg>
`;
}

const entries: Entry[] = [];
for (const t of themes) {
  t.subs.forEach((s, i) => {
    entries.push({
      id: `${t.theme}-${String(i + 1).padStart(2, '0')}`,
      theme: t.theme,
      themeLabel: t.themeLabel,
      color: t.color,
      subtopic: s.slug,
      subtopicLabel: s.label,
      captionFr: s.captionFr,
      culturalLinkFr: s.culturalLinkFr,
    });
  });
}

const manifest = entries.map((e) => ({
  id: e.id,
  theme: e.theme,
  subtopic: e.subtopic,
  imageFile: `${e.id}.svg`,
  captionFr: e.captionFr,
  culturalLinkFr: e.culturalLinkFr,
  attribution: 'Placeholder asset — replace with a licensed photo',
  licenseName: 'Placeholder',
  sourceUrl: 'about:blank',
}));

for (const e of entries) {
  writeFileSync(join(imgDir, `${e.id}.svg`), svgFor(e), 'utf8');
}
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log(`Wrote ${entries.length} placeholder SVGs and manifest.json to ${outDir}`);
