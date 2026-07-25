# Parlons

AI mock **Individual Oral (IO)** practice for IB French B (SL). A student runs a full,
timed mock exam on demand: visual stimulus → 15-minute prep → 3–4 minute presentation →
adaptive examiner questions → a scored report against paraphrased IB-style criteria.

> Parlons is not affiliated with or endorsed by the IB. All marks are practice
> estimates, never official predicted grades.

## Status

This is the **M1 core loop** build:

- ✅ Full SL flow end-to-end (setup → consent → prep → Part 1 → Part 2 → Part 3 → report → history)
- ✅ Supabase Postgres + Supabase Storage for sessions, transcripts and audio
- ✅ `ExaminerService` abstraction with a **mock** implementation (runs with no API key) and a
  **Gemini Live** implementation that activates automatically once `GEMINI_API_KEY` is set
- ✅ Rubric scoring engine with structurally-enforced transcript citation
- ⚠️ 25 stimuli are **placeholder SVGs** — replace with licensed photos (see below)
- ❌ Not yet built: HL mode, teacher dashboard, admin panel, billing, PDF export

## Setup

### 1. Supabase

Create a project at [supabase.com](https://supabase.com), then:

- **Database** → copy the connection strings (pooled for `DATABASE_URL`, direct for `DIRECT_URL`)
- **Storage** → create a **private** bucket named `session-audio`
- **Settings → API** → copy the project URL and the `service_role` key

### 2. Environment

```bash
cp .env.example .env
# fill in DATABASE_URL, DIRECT_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

Leave `GEMINI_API_KEY` unset to run in **mock mode** — the app is fully clickable with a
canned French examiner and a fixture score report.

### 3. Install, migrate, seed

```bash
npm install
npm run db:migrate --workspace=apps/server   # creates tables in Supabase
npm run db:seed --workspace=apps/server      # loads the 25 stimuli
```

### 4. Run

```bash
npm run dev     # server on :3001, web on :5173
```

Open http://localhost:5173.

## Enabling the real AI examiner

Add a Gemini API key to `.env`:

```
GEMINI_API_KEY="..."
```

Restart the server. `GET /api/health` reports which examiner is active. No code changes
are needed — the factory in [apps/server/src/examiner/index.ts](apps/server/src/examiner/index.ts)
swaps `MockExaminerService` for `GeminiExaminerService`.

Note: Gemini Live sessions are opened **per exam phase** rather than once per exam, because
audio sessions are capped near 15 minutes — close to the total spoken exam time. Cross-phase
context is carried forward via the transcript, not Gemini's own session resumption.

## Replacing the placeholder stimuli

The 25 seeded stimuli are generated SVG placeholders, deliberately obvious so they can't be
mistaken for real exam material. To swap in real images:

1. Drop licensed image files into `data/stimuli/images/`
2. Update the matching entries in `data/stimuli/manifest.json` (`imageFile`, `attribution`,
   `licenseName`, `sourceUrl` must all be real)
3. `npm run verify:stimuli` — enforces the license allow-list, file existence and theme coverage
4. `npm run db:seed --workspace=apps/server` — upserts idempotently

## Testing

```bash
npm test              # all workspaces
npm run verify:stimuli
```

Covered automatically: session state machine transitions, WS message contract, scoring
prompt guardrails (evidence-citation enforcement, IB-verbatim denylist), mock examiner flow.

Requires manual browser testing: mic permission, recording quality, examiner latency feel,
iPad Safari audio behaviour.

Requires a real `GEMINI_API_KEY`: live French TTS quality, barge-in behaviour, real scoring
quality, end-to-end latency against the <2.5s target.

## Architecture

```
apps/web        React + TS + Vite + Tailwind — screens, mic capture, PCM playback
apps/server     Fastify — REST, WS gateway, session state machine, examiner + scoring
packages/shared Zod-typed WS contract, DTOs, enums, paraphrased band labels
data/stimuli    Manifest + images (placeholders today)
```

The browser never talks to Gemini directly — audio is proxied through the backend so the
API key is never exposed.
