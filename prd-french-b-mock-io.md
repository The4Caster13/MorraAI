# PRD — "Morrai" : AI Mock Individual Oral (IO) Practice App for IB French B

**Version:** 0.1 (Draft)
**Author:** [You] + Claude
**Status:** For review
**Last updated:** 25 July 2026

---

## 1. Vision

IB French B students sit a high-stakes Individual Oral (IO) worth 25% of their final grade, yet most get only one or two full mock IOs with a teacher before the real exam. Practice is scarce because it requires a fluent examiner, 15–20 minutes of 1-on-1 time, and expert knowledge of the IB rubric.

**Morrai** is a web app that lets any French B student run a complete, realistic mock IO on demand. An AI examiner presents a visual stimulus drawn from the five IB themes, listens to the student's live spoken presentation, asks adaptive follow-up questions calibrated to the student's demonstrated level, and returns a full mark breakdown against the official IB assessment criteria — with actionable feedback on language, message, and interactive skills.

### Who it's for

- **Primary:** IB Diploma students taking French B (SL and HL), typically ages 16–18, preparing for the IO in Year 2.
- **Secondary:** French B teachers who want to assign structured practice and review AI-generated score reports.
- **Tertiary (later):** Extensible to other Language B subjects (Spanish B, English B, etc.).

### Problem it solves

1. Students cannot self-assess spoken French against the IB rubric.
2. Teachers do not have time to run repeated 1-on-1 mocks per student.
3. Existing tools (flashcards, generic chatbots) do not replicate the real IO format: timed prep, visual stimulus, live presentation, and an examiner who probes based on what the student actually said.

---

## 2. Background: The Real IB French B IO Format (SL)

The product must faithfully mirror the exam so practice transfers:

| Phase | Duration | What happens |
|---|---|---|
| Preparation | 15 min | Student receives a visual stimulus linked to one of the five themes and prepares notes (max 10 bullet points). |
| Part 1 — Presentation | 3–4 min | Student describes the stimulus and relates it to the theme and target culture. |
| Part 2 — Discussion of stimulus | 4–5 min | Examiner asks follow-up questions on the presentation/stimulus. |
| Part 3 — General conversation | 5–6 min | Broader conversation on one or more of the five themes. |

**The five prescribed themes:** Identités, Expériences, Ingéniosité humaine, Organisation sociale, Partage de la planète.

**Assessment criteria (SL, 30 marks total):**

- **Criterion A — Language** (12 marks): command of vocabulary, grammar, pronunciation, intonation, fluency.
- **Criterion B1 — Message: visual stimulus** (6 marks): relevance and depth of ideas linked to the stimulus and target culture.
- **Criterion B2 — Message: conversation** (6 marks): relevance and depth of responses in Parts 2–3.
- **Criterion C — Interactive skills** (6 marks): comprehension of questions, independence and sustainment of conversation.

HL differs (literary extract instead of visual stimulus). **HL mode is out of scope for v1** but the architecture should not preclude it.

*Note: exact rubric wording is IB copyright; the app paraphrases descriptors and links to official documentation rather than reproducing them verbatim.*

---

## 3. Goals & Success Metrics

### Goals

1. A student can complete a full, timed mock IO (prep → presentation → adaptive Q&A → score report) with zero teacher involvement.
2. AI scores correlate with teacher scores within ±3 marks (of 30) on a validation set of recorded mocks.
3. Feedback is specific enough that a student knows exactly what to do differently next time.

### Success metrics (first 3 months post-launch)

- ≥ 70% of started mocks completed end-to-end.
- Average of ≥ 3 mocks per active student (repeat use = perceived value).
- Student-reported usefulness ≥ 4/5.
- Scoring agreement study vs. 2 experienced teachers on 30 sample recordings: mean absolute error ≤ 3 marks.

### Non-goals (v1)

- No official grade prediction claims ("this is your IB grade").
- No HL literary-extract mode.
- No teacher dashboard / classroom management (v2).
- No offline mode.

---

## 4. Core User Flow

1. **Setup** — Student selects level (SL), theme (or "random," as in the real exam the teacher picks), and starts a session.
2. **Stimulus delivery** — App presents a visual stimulus (captioned image with theme label) from the curated image database.
3. **Prep timer (15 min, skippable/adjustable in practice mode)** — Student takes notes in a built-in notepad limited to 10 bullet points, mirroring exam rules.
4. **Part 1: Presentation (3–4 min)** — Student speaks; app records audio, transcribes live, and displays an unobtrusive timer. At 4:00 the examiner politely interrupts, as a real examiner would.
5. **Part 2: Stimulus discussion (4–5 min)** — The AI examiner asks questions *generated from the student's actual presentation content and demonstrated level* (see §6.3). Spoken via TTS in French; student replies by voice.
6. **Part 3: General conversation (5–6 min)** — Examiner broadens to other themes, still adapting difficulty.
7. **Scoring & report** — App produces: full transcript (with per-phase segmentation), marks for A / B1 / B2 / C with rationale, an annotated list of language errors and strong moments, and 3 prioritized improvement actions.
8. **History** — Session saved; student can track scores across attempts per criterion.

---

## 5. Feature Requirements

### 5.1 Visual stimulus database

- **P0** Curated database of images tagged by theme, sub-topic (e.g., *Partage de la planète → environnement, urbanisation*), and francophone cultural context.
- **P0** Images sourced via Google Programmable Search / Google Custom Search API **restricted to licensed/reusable images**, then human-approved before entering the student-facing pool. (AI proposes; an admin approves. Unreviewed images are never shown to students.)
- **P0** Each stimulus stored with: image URL/local copy, caption, theme, difficulty tag, cultural link, attribution/license metadata.
- **P1** Admin panel to add/remove/edit stimuli.
- **P2** AI-generated stimulus suggestions ranked by similarity to past IB-style stimuli.

### 5.2 Live audio capture & transcription

- **P0** Browser microphone capture (Web Audio / MediaRecorder), streamed to backend.
- **P0** Real-time French speech-to-text with timestamps; transcript segmented by IO phase.
- **P0** Recording stored per session for replay and re-analysis.
- **P1** Word-level timestamps to support fluency metrics (pauses, speech rate, false starts).

### 5.3 Real-time speech analysis (during recording)

The AI analyzes the stream as it arrives, on two axes:

- **Delivery:** speech rate (words/min), pause frequency and length, filler words ("euh," "ben"), self-corrections, intonation flatness (P1), pronunciation flags on high-confidence errors (P1).
- **Quality of language:** grammatical accuracy, vocabulary range and idiomaticity, register, complexity of structures (subordination, tense variety), anglicisms/calques.

Output: a running "competence estimate" per criterion that feeds question generation (§5.4) and final scoring (§5.5).

### 5.4 Adaptive AI examiner (Parts 2–3)

- **P0** Questions are generated from the transcript of the student's own presentation — never from a static bank alone — and reference specific things the student said.
- **P0** Difficulty adapts to the running competence estimate:
  - Struggling student → shorter, concrete, present-tense questions; rephrasing on request ("Pouvez-vous répéter ?" is handled gracefully).
  - Strong student → abstract, comparative, hypothetical questions (conditional/subjunctive triggers) to give them room to reach top bands.
- **P0** Examiner speaks French via TTS; text of the question is hidden by default (real-exam mode) with an accessibility toggle to show it (practice mode).
- **P0** Examiner follows IB examiner conduct: doesn't correct the student mid-session, keeps questions open-ended, manages timing.
- **P1** Barge-in handling: examiner waits for natural end of student answer (silence detection) before next question.

### 5.5 Rubric scoring engine

- **P0** After the session, the AI grades the full transcript + delivery metrics against paraphrased IB descriptors for A, B1, B2, C, returning: mark per criterion, band justification quoting evidence from the transcript, and total /30.
- **P0** The Q&A phases are graded too (this is B2 and C): comprehension of questions, relevance and development of answers, independence of interaction.
- **P0** Explicit uncertainty note where audio quality or transcription confidence is low.
- **P1** Error log: table of language errors (what was said → correction → rule), capped and prioritized by frequency/impact.
- **P1** Longitudinal view: per-criterion progress chart across sessions.

### 5.6 Reports & feedback

- **P0** One-page score report: marks, rationale, top 3 strengths, top 3 priorities, suggested drills (e.g., "practise passé composé vs. imparfait narration").
- **P1** Shareable/exportable report (PDF) a student can bring to their teacher.

---

## 6. Technical Constraints & Architecture

### 6.1 Stack (as specified)

- **Frontend:** React (TypeScript recommended) + Tailwind CSS. Vite build.
- **Backend:** Node.js (Express or Fastify) — session orchestration, auth, DB, exam state machine.
- **Python microservice (optional, at discretion):** audio feature extraction (speech rate, pause detection) if the chosen AI API doesn't provide these natively; otherwise skip to reduce ops burden.
- **Database:** PostgreSQL (sessions, users, stimuli, scores) + object storage (S3-compatible) for audio.

### 6.2 AI services

- **Realtime multimodal model:** Google Gemini Live/Realtime API as specified — handles streaming audio in, live transcription, delivery/quality analysis, question generation, and TTS out, minimizing glue code and latency.
- **Design for provider abstraction:** wrap all model calls behind an internal `ExaminerService` interface so the LLM (Gemini, Claude, etc.) and STT/TTS providers can be swapped or mixed (e.g., a different model for final rubric scoring than for live interaction) without touching product code.
- **Image sourcing:** Google Custom Search API with license filters, feeding the human-reviewed stimulus pool.

### 6.3 The adaptive loop (core system behavior)

```
audio stream → live STT → rolling transcript
                     ↓
        delivery + quality analyzers (streaming)
                     ↓
        competence estimate {A, B1, B2, C}
                     ↓
   question generator (transcript + estimate + phase + time left)
                     ↓
              TTS → student hears question
                     ↓ (student answers — loop)
session end → full transcript + metrics → rubric scorer → report
```

### 6.4 What the system must NOT do

- **Never show students unreviewed scraped images.**
- **Never reproduce IB rubric text verbatim** or claim official IB affiliation/endorsement.
- **Never present AI marks as official predicted grades** — always framed as practice estimates.
- **No correction or English fallback mid-exam in real-exam mode** (breaks realism); corrections live only in the post-session report and practice mode.
- **No storing audio without consent**; minors' data handled per GDPR/COPPA-equivalent — clear consent flow, deletion on request, no training on student audio without opt-in.
- **No hallucinated feedback:** every scoring justification must cite the transcript; if evidence is missing, say so.

### 6.5 Non-functional requirements

- Examiner question latency after student finishes speaking: **< 2.5 s** (realism threshold).
- Transcription accuracy target: WER ≤ 15% on accented learner French (validated on sample recordings).
- Works on Chrome/Safari/Edge desktop + iPad (many schools are iPad-based).
- Accessibility: captions toggle, keyboard navigation, adjustable timers for accommodations.
- Uptime 99.5%; sessions recover gracefully from a dropped connection (resume mid-phase).

---

## 7. Milestones

| Milestone | Scope | Target |
|---|---|---|
| M0 — Spike | Latency test: live audio → Gemini → French TTS question round-trip | Week 2 |
| M1 — Core loop | Full SL flow with 25 curated stimuli, live transcription, adaptive Q&A, basic scoring | Week 8 |
| M2 — Scoring quality | Rubric engine validated vs. teacher marks (≤ ±3), error log, reports | Week 12 |
| M3 — Beta | 2–3 partner schools, progress tracking, admin stimulus panel | Week 16 |
| M4 — v1 launch | Polish, PDF export, billing (if applicable) | Week 20 |

---

## 8. Risks & Open Questions

1. **Scoring validity** — Will AI marks be trusted? Mitigation: teacher-validation study before launch; show evidence-based rationale, not just numbers.
2. **Learner-accent STT accuracy** — Transcription errors could unfairly lower Criterion A. Mitigation: confidence-aware scoring; flag low-confidence segments instead of penalizing.
3. **Latency** — A slow examiner kills immersion. Mitigation: streaming architecture, M0 spike gate.
4. **Image licensing** — Mitigation: license-filtered search + stored attribution + human review.
5. **Open:** Do we support the teacher choosing the stimulus (real-exam rule) vs. student choice (practice convenience)? Proposal: both, as "Exam mode" vs. "Practice mode."
6. **Open:** Pricing model — school licenses vs. individual student subscriptions?
7. **Open:** Should Part 3 draw on the student's saved profile (themes already practised) to avoid repetition across sessions?
