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
- ✅ Rubric scoring engine that requires at least one transcript quote per criterion
- ⚠️ 25 stimuli are **placeholder SVGs** — replace with licensed photos (see below)
- ⚠️ **No authentication.** `userId` is a UUID the browser generates and stores in
  `localStorage`. Routes check that the caller's `userId` owns the session, which stops a
  leaked session ID from exposing someone's recording — but anyone who learns a `userId`
  can still act as that user. Real signed sessions are required before this handles
  student voice data outside a trusted test group.
- ⚠️ Delivery analysis (speech rate, pauses, fillers) from PRD §5.3 is **not implemented**.
  The adaptive difficulty signal is a coarse heuristic over utterance length and tense
  variety in `SessionRuntime.competenceEstimate`.
- ⚠️ A session cannot survive a **server** restart: runtime state is in-memory, and
  interrupted sessions are marked `ERROR` on boot. Browser refreshes are fine.
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
npm install                                  # also runs `prisma generate`
npm run db:deploy --workspace=apps/server    # applies prisma/migrations to Supabase
npm run db:seed --workspace=apps/server      # loads the 25 stimuli
```

Use `db:deploy` (not `db:migrate`) for a first run and for any deployment — it applies the
committed migration non-interactively. `db:migrate` runs `prisma migrate dev`, which is for
authoring *new* migrations during development and will prompt.

### 4. Run

```bash
npm run dev     # server on :3001, web on :5173
```

Open http://localhost:5173.

## Deploying

The app deploys as a **single service**: with `NODE_ENV=production` the Fastify server
serves the API, the WebSocket gateway and the built SPA from one origin, so there is no
proxy or CORS configuration to get wrong.

```bash
docker build -t parlons .
docker run -p 3001:3001 --env-file .env -e NODE_ENV=production parlons
```

Migrations are deliberately **not** run on container boot — apply them as a separate step
so a crash-looping deploy can't half-apply a schema change:

```bash
npm run db:deploy --workspace=apps/server
```

Note that the server runs TypeScript directly via `tsx` rather than compiling to JavaScript.
That keeps the toolchain simple at the cost of a slower cold start; if boot time starts to
matter, add a real `tsc` emit step and a `dist` entrypoint.

Before pointing real students at a deployment, read the ⚠️ items under **Status** — in
particular, the lack of authentication.

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
prompt guardrails (evidence-citation enforcement, IB-verbatim denylist), mock examiner flow,
Gemini transcript turn-buffering, WAV encoding.

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
