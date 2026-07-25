import { BookOpen, Globe, Lightbulb, Leaf, Users, type LucideIcon } from 'lucide-react';
import { THEME_LABELS, type Theme } from '@parlons/shared';

/**
 * Presentation-only metadata for the five IB themes: icon, accent colour and the
 * marketing photo shown on the landing pages and theme picker.
 *
 * These photos are illustrative branding only. The actual exam stimulus always
 * comes from the reviewed database pool via the API — never from this file.
 */
export interface ThemeContent {
  id: Theme;
  label: string;
  subtitle: string;
  icon: LucideIcon;
  color: string;
  description: string;
  heroImage: string;
  heroAlt: string;
}

export const THEME_CONTENT: ThemeContent[] = [
  {
    id: 'identites',
    label: THEME_LABELS.identites,
    subtitle: 'Identities',
    icon: Users,
    color: '#1b4fd8',
    description:
      'Culture nationale et régionale, identité culturelle, croyances et valeurs, sous-culture.',
    heroImage:
      'https://images.unsplash.com/photo-1531742633345-8adf1181733c?w=800&h=600&fit=crop&auto=format',
    heroAlt: 'Expression culturelle et identité personnelle',
  },
  {
    id: 'experiences',
    label: THEME_LABELS.experiences,
    subtitle: 'Experiences',
    icon: BookOpen,
    color: '#0ea5e9',
    description: 'Loisirs, vacances et tourisme, rites de passage, coutumes et traditions.',
    heroImage:
      'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&h=600&fit=crop&auto=format',
    heroAlt: 'Voyage et découverte de nouvelles cultures',
  },
  {
    id: 'ingeniosite',
    label: THEME_LABELS.ingeniosite,
    subtitle: 'Human Ingenuity',
    icon: Lightbulb,
    color: '#7c3aed',
    description:
      'Divertissements, expressions artistiques, communications et médias, technologie.',
    heroImage:
      'https://images.unsplash.com/photo-1581090464777-f3220bbe1b8b?w=800&h=600&fit=crop&auto=format',
    heroAlt: 'Robotique et innovation technologique',
  },
  {
    id: 'organisation',
    label: THEME_LABELS.organisation,
    subtitle: 'Social Organisation',
    icon: Globe,
    color: '#059669',
    description: 'Voisinage, éducation, monde du travail, médias et communication.',
    heroImage:
      'https://images.unsplash.com/photo-1767274075370-d6aecfd8969d?w=800&h=600&fit=crop&auto=format',
    heroAlt: 'Mouvements sociaux et engagement citoyen',
  },
  {
    id: 'planete',
    label: THEME_LABELS.planete,
    subtitle: 'Sharing the Planet',
    icon: Leaf,
    color: '#16a34a',
    description: 'Environnement, paix et conflits, égalité, mondialisation.',
    heroImage:
      'https://images.unsplash.com/photo-1585871746932-e133d3fedf4d?w=800&h=600&fit=crop&auto=format',
    heroAlt: 'Notre planète : une ressource précieuse à protéger',
  },
];

export function themeContent(id: Theme): ThemeContent {
  return THEME_CONTENT.find((t) => t.id === id) ?? THEME_CONTENT[0];
}

/** Paraphrased criteria, matching the marks the scoring engine actually returns. */
export const CRITERIA_SUMMARY = [
  {
    code: 'A',
    label: 'Langue',
    max: 12,
    desc: 'Vocabulaire, grammaire, prononciation, intonation et aisance du débit.',
  },
  {
    code: 'B1',
    label: 'Message — stimulus visuel',
    max: 6,
    desc: 'Pertinence et profondeur des idées liées à l’image et à la culture francophone.',
  },
  {
    code: 'B2',
    label: 'Message — conversation',
    max: 6,
    desc: 'Pertinence et développement des réponses dans les parties 2 et 3.',
  },
  {
    code: 'C',
    label: 'Compétences interactives',
    max: 6,
    desc: 'Compréhension des questions, autonomie et maintien de la conversation.',
  },
] as const;
