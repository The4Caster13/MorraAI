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
- ✅ Scoring sends the student's actual recordings to Gemini (via the Files API), so Criterion A
  is judged on pronunciation, intonation and fluency — not text alone. If live speech-to-text
  produced no transcript, what the scorer heard backfills it. See "How scoring hears you" below.
- ⚠️ 25 stimuli are **placeholder SVGs** — replace with licensed photos (see below)
- ⚠️ **No authentication.** `userId` is a UUID the browser generates and stores in
  `localStorage`. Routes check that the caller's `userId` owns the session, which stops a
  leaked session ID from exposing someone's recording — but anyone who learns a `userId`
  can still act as that user. Real signed sessions are required before this handles
  student voice data outside a trusted test group.
- ⚠️ Real-time delivery analysis *during* the exam (running speech-rate/pause metrics from PRD
  §5.3, feeding the live competence estimate) is not implemented — delivery is assessed once,
  from the recordings, at scoring time.
  The adaptive difficulty signal is a coarse heuristic over utterance length and tense
  variety in `SessionRuntime.competenceEstimate`.
- ⚠️ A session cannot survive a **server** restart: runtime state is in-memory, and
  interrupted sessions are marked `ERROR` on boot. Browser refreshes are fine.
- ❌ Not yet built: HL mode, teacher dashboard, admin panel, billing, PDF export

## Setup

### 1. Database — local Postgres (recommended for dev) or Supabase

**Local** is the default and is dramatically faster to develop against — every query to a
distant Supabase region measured **1.1–3.5 seconds**; local Postgres measured **0–37ms** (see
"Why local Postgres" below). No Docker needed:

```bash
brew install postgresql@17
brew services start postgresql@17
createdb parlons
```

```
# .env
DATABASE_URL=postgresql://YOUR_OS_USERNAME@localhost:5432/parlons
DIRECT_URL=postgresql://YOUR_OS_USERNAME@localhost:5432/parlons
```

Homebrew's default cluster uses peer auth keyed to your OS username (`whoami`) — there is no
`postgres` role, so a URL without a username fails with `P1010: User was denied access`.

Audio storage defaults to local disk (`storage/audio/`, gitignored) automatically whenever
`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are unset — no extra setup.

**Supabase**, if you want hosted Postgres + Storage instead: create a project at
[supabase.com](https://supabase.com), then:

- **Database** → copy the connection strings (pooled for `DATABASE_URL`, direct for `DIRECT_URL`)
- **Storage** → create a **private** bucket named `session-audio`
- **Settings → API** → copy the project URL and the `service_role` key

### 2. Environment

```bash
cp .env.example .env
# fill in DATABASE_URL / DIRECT_URL (local or Supabase, per above)
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

## Why local Postgres — and what else was fixed

Every REST/WS call touches the database at least once, and against Supabase's `ca-central-1`
pooler that measured **1.1–3.5 seconds per query**, steady-state, with a warm connection
pool — pure network distance, not an inefficiency. That's the felt "3 seconds for anything."
Local Postgres measured **0–37ms** for the same query. Switching removes the lag from every
interaction at once; a real Supabase deployment still needs a region close to its users.

Two bugs surfaced once queries got fast enough to expose them, both now covered by regression
tests:

- **`SessionRuntime.setStatus` used to await its DB write before telling the client the phase
  had changed** — so every button press had a dead pause equal to one database round trip
  before anything visibly happened, on *any* backend, not just a slow one. It now updates
  in-memory state and notifies the client synchronously; the persistence write runs in the
  background and is only logged on failure. The in-memory status was already what the live
  WebSocket gateway trusts, so the DB row is durability-only (history, resuming a lookup after
  a restart) — never the source of truth for a connected client. See
  [setStatusLatency.test.ts](apps/server/src/session/setStatusLatency.test.ts), which fails
  by hanging if this regresses.
- **The WebSocket gateway dropped messages sent immediately after the client's socket
  opened.** `ws` emits `'message'` as frames arrive off the wire and does not queue them for a
  listener attached later, so `client:ready` + `client:startPhase` sent right after `onopen`
  could arrive *before* `socket.on('message', ...)` was registered — lost entirely, no matter
  how fast the preceding DB lookup was. Fixed by buffering into a queue until the real handler
  is attached, then draining it. See the buffering block at the top of
  [gateway.ts](apps/server/src/ws/gateway.ts).

## Deploying

The app deploys as a **single service**: with `NODE_ENV=production` the Fastify server
serves the API, the WebSocket gateway and the built SPA from one origin, so there is no
proxy or CORS configuration to get wrong.

A deployed container can't reach the `localhost` Postgres used for dev — point `DATABASE_URL`
at Supabase (or any reachable hosted Postgres) in the deployment's environment, and pick a
region close to your actual users this time (see "Why local Postgres" above).

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

Get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and add it to
`.env`:

```
GEMINI_API_KEY="..."
```

Then check it before running the app:

```bash
npm run check:gemini    # verifies key, both model names, and latency
```

Restart the server. `GET /api/health` reports which examiner is active. No code changes
are needed — the factory in [apps/server/src/examiner/index.ts](apps/server/src/examiner/index.ts)
swaps `MockExaminerService` for `GeminiExaminerService`.

<<<<<<< Updated upstream
Live API models are preview-tier and are retired regularly. If `check:gemini` returns a 404,
consult [the deprecations page](https://ai.google.dev/gemini-api/docs/deprecations) and
update `GEMINI_LIVE_MODEL`.

See [TESTING.md](TESTING.md) for the full step-by-step.
=======
**Model IDs drift.** `gemini-2.5-flash` was rejected for this project's key with `404 ... no
longer available to new users` — confirmed directly against the account, not just documentation.
`GEMINI_SCORING_MODEL` defaults to `gemini-3.5-flash`; if that also 404s later, run
`ai.models.list()` and filter for `generateContent` support to find a current one. Aliases like
`gemini-flash-latest` are not a safe workaround — it resolved to the same deprecated `2.5-flash`
snapshot when tested.
>>>>>>> Stashed changes

Note: Gemini Live sessions are opened **per exam phase** rather than once per exam, because
audio sessions are capped near 15 minutes — close to the total spoken exam time. Cross-phase
context is carried forward via the transcript, not Gemini's own session resumption.

## How scoring hears you

Live transcription during the exam is speech-to-text only — it never hears pronunciation,
intonation, or fluency, all of which Criterion A requires. So at scoring time
([scoreSession.ts](apps/server/src/scoring/scoreSession.ts)), the student's stored recordings
for every phase are re-fetched from Supabase Storage and uploaded to Gemini via the **Files
API** ([GeminiExaminerService.ts](apps/server/src/examiner/GeminiExaminerService.ts)) — inline
audio caps out at 20 MB and a full exam's PCM can exceed that. The scorer is instructed to:

1. **Transcribe** what it actually hears (not corrected), phase by phase.
2. **Assess delivery** — pronunciation, intonation, fluency, pace — with concrete observations.
3. **Judge Criterion A** on both language *and* delivery, justification citing both.

If live STT produced no transcript for a phase, the model's own transcription backfills it, so
the report still shows what was said even when the realtime path dropped audio. Uploaded files
are deleted after scoring regardless of outcome. A session with no usable recording is scored
from text alone, and the report says so explicitly (`delivery.audioAssessed: false`) rather than
inventing pronunciation notes — verified in
[scoreSession.test.ts](apps/server/src/scoring/scoreSession.test.ts).

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
