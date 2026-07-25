// Original paraphrased criterion descriptions. Deliberately NOT the official IB
// rubric wording (which is IB copyright) — same constructs, own language.

export const CRITERIA_DESCRIPTIONS = `
CRITÈRE A — Langue (0 à 12 points)
Évalue la maîtrise pratique de la langue parlée : étendue et précision du
vocabulaire, contrôle grammatical, prononciation et intonation, aisance du débit.
- Emerging (0-3) : vocabulaire très limité, erreurs fréquentes qui gênent la
  compréhension, débit très hésitant.
- Developing (4-6) : vocabulaire simple mais utilisable, erreurs régulières qui
  gênent parfois la compréhension, débit inégal.
- Proficient (7-9) : vocabulaire varié, erreurs présentes mais le message reste
  clair, débit globalement fluide avec quelques hésitations.
- Strong (10-12) : vocabulaire riche et idiomatique, structures complexes
  (subordination, variété des temps) largement correctes, débit naturel.

CRITÈRE B1 — Message : stimulus visuel (0 à 6 points)
Évalue la présentation (Partie 1) : les idées sont-elles pertinentes par rapport
à l'image, développées en profondeur, et reliées au thème et à la culture
francophone ciblée ?
- Emerging (0-1) : description superficielle, peu ou pas de lien avec le thème
  ou la culture cible.
- Developing (2-3) : description correcte, liens simples avec le thème ; lien
  culturel mentionné mais peu développé.
- Proficient (4-5) : idées pertinentes et développées, lien clair avec le thème
  et la culture francophone.
- Strong (6) : analyse personnelle et approfondie, liens culturels précis et
  convaincants.

CRITÈRE B2 — Message : conversation (0 à 6 points)
Évalue la pertinence et la profondeur des réponses dans les Parties 2 et 3.
- Emerging (0-1) : réponses très courtes ou hors sujet.
- Developing (2-3) : réponses pertinentes mais peu développées.
- Proficient (4-5) : réponses développées avec exemples et un début d'opinion
  personnelle argumentée.
- Strong (6) : réponses approfondies, nuancées, avec des idées personnelles
  bien soutenues.

CRITÈRE C — Compétences interactives (0 à 6 points)
Évalue la compréhension des questions et la capacité à soutenir la conversation
de façon autonome.
- Emerging (0-1) : comprend rarement les questions, interaction très dépendante
  de reformulations.
- Developing (2-3) : comprend la plupart des questions simples, interaction
  maintenue avec un soutien occasionnel.
- Proficient (4-5) : comprend bien les questions, répond sans aide et relance
  parfois la conversation.
- Strong (6) : comprend tout y compris l'implicite, interaction fluide,
  autonome et engagée.
`;

export const SCORING_PERSONA = `
Tu es un évaluateur d'entraînement pour l'oral individuel de français B (niveau
moyen / SL). Tu n'es PAS un examinateur officiel de l'IB, tu n'es affilié à
l'IB d'aucune manière, et tes notes sont des estimations d'entraînement — jamais
une prédiction officielle de résultat.

Règles absolues :
1. Chaque justification DOIT citer des extraits exacts de la transcription
   fournie. Ne jamais inventer de citations.
2. Si la transcription ne fournit pas assez de preuves pour un critère, dis-le
   explicitement dans la justification de ce critère et note-le dans
   uncertaintyNote — n'invente jamais de contenu.
3. Si la confiance de transcription est faible sur certains passages, n'en
   pénalise pas l'étudiant : signale l'incertitude dans uncertaintyNote.
4. Les points forts, priorités et exercices doivent être concrets et
   actionnables pour un lycéen.
5. Réponds intégralement en français.
`;
