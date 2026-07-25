import { BookOpen, Globe, Lightbulb, Leaf, Users, type LucideIcon } from 'lucide-react';
import { THEME_LABELS, THEME_LABELS_EN, type Theme } from '@morrai/shared';

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
    subtitle: THEME_LABELS_EN.identites,
    icon: Users,
    color: '#1b4fd8',
    description:
      'National and regional culture, cultural identity, beliefs and values, subcultures.',
    heroImage:
      'https://images.unsplash.com/photo-1531742633345-8adf1181733c?w=800&h=600&fit=crop&auto=format',
    heroAlt: 'Cultural expression and personal identity',
  },
  {
    id: 'experiences',
    label: THEME_LABELS.experiences,
    subtitle: THEME_LABELS_EN.experiences,
    icon: BookOpen,
    color: '#0ea5e9',
    description: 'Leisure, holidays and travel, rites of passage, customs and traditions.',
    heroImage:
      'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&h=600&fit=crop&auto=format',
    heroAlt: 'Travel and discovering new cultures',
  },
  {
    id: 'ingeniosite',
    label: THEME_LABELS.ingeniosite,
    subtitle: THEME_LABELS_EN.ingeniosite,
    icon: Lightbulb,
    color: '#7c3aed',
    description:
      'Entertainment, artistic expression, communication and media, technology.',
    heroImage:
      'https://images.unsplash.com/photo-1581090464777-f3220bbe1b8b?w=800&h=600&fit=crop&auto=format',
    heroAlt: 'Robotics and technological innovation',
  },
  {
    id: 'organisation',
    label: THEME_LABELS.organisation,
    subtitle: THEME_LABELS_EN.organisation,
    icon: Globe,
    color: '#059669',
    description: 'Neighbourhoods, education, the world of work, media and communication.',
    heroImage:
      'https://images.unsplash.com/photo-1767274075370-d6aecfd8969d?w=800&h=600&fit=crop&auto=format',
    heroAlt: 'Social movements and civic engagement',
  },
  {
    id: 'planete',
    label: THEME_LABELS.planete,
    subtitle: THEME_LABELS_EN.planete,
    icon: Leaf,
    color: '#16a34a',
    description: 'The environment, peace and conflict, equality, globalisation.',
    heroImage:
      'https://images.unsplash.com/photo-1585871746932-e133d3fedf4d?w=800&h=600&fit=crop&auto=format',
    heroAlt: 'Our planet: a precious resource to protect',
  },
];

export function themeContent(id: Theme): ThemeContent {
  return THEME_CONTENT.find((t) => t.id === id) ?? THEME_CONTENT[0];
}

/** Paraphrased criteria, matching the marks the scoring engine actually returns. */
export const CRITERIA_SUMMARY = [
  {
    code: 'A',
    label: 'Language',
    max: 12,
    desc: 'Vocabulary, grammar, pronunciation, intonation and fluency of delivery.',
  },
  {
    code: 'B1',
    label: 'Message — visual stimulus',
    max: 6,
    desc: 'Relevance and depth of ideas linked to the image and to francophone culture.',
  },
  {
    code: 'B2',
    label: 'Message — conversation',
    max: 6,
    desc: 'Relevance and development of answers in parts 2 and 3.',
  },
  {
    code: 'C',
    label: 'Interactive skills',
    max: 6,
    desc: 'Understanding the questions, independence and sustaining the conversation.',
  },
] as const;
