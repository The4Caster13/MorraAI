# Testing Parlons

A practical guide to running the app end-to-end. Written for demo/hackathon use — the
fastest path first, the realistic path second.

---

## Path A — Mock mode (no Gemini key, no microphone)

The whole flow works with a canned French examiner and a fixture score report. This is the
right way to check that plumbing works, to demo the UX, and to develop against.

### 1. Get a Postgres database

Prisma needs a real Postgres. Fastest option is a free Supabase project:

1. Create a project at [supabase.com](https://supabase.com)
2. **Settings → Database** → copy the **pooled** connection string (port 6543) and the
   **direct** one (port 5432)

Any Postgres works. Local Docker is fine too:

```bash
docker run -d --name parlons-db -e POSTGRES_PASSWORD=parlons -p 5432:5432 postgres:16
# DATABASE_URL="postgresql://postgres:parlons@localhost:5432/postgres"
```

`DIRECT_URL` is optional — it defaults to `DATABASE_URL`. You only need to set it separately
when `DATABASE_URL` points at a connection pooler, because migrations can't run through one.
That's the Supabase case: pooled URL on port 6543, direct on 5432.

Put `.env` at the **repo root**, not in `apps/server/`. Both are read (`apps/server/.env`
wins if present), but the root is the documented location.

### 2. Environment

```bash
cp .env.example .env
```

Fill in `DATABASE_URL` and `DIRECT_URL`. **Leave `GEMINI_API_KEY` commented out** — that is
what selects mock mode.

The Supabase *storage* variables are only used to save audio for replay. If you don't care
about that yet, dummy values are fine — uploads fail into a caught error and the session
still completes normally:

```
SUPABASE_URL="https://placeholder.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="placeholder"
```

To actually store audio, create a **private** bucket named `session-audio` under
**Storage**, and use the real project URL plus the `service_role` key from
**Settings → API**.

### 3. Install, migrate, seed

```bash
npm install                                  # also runs `prisma generate`
npm run db:deploy --workspace=apps/server    # creates the tables
npm run db:seed --workspace=apps/server      # loads the 25 stimuli
```

### 4. Run

```bash
npm run dev     # server on :3001, web on :5173
```

Open <http://localhost:5173>.

### 5. Walk the flow

**Choose "Mode entraînement" (practice), not exam mode.** Practice mode is what unlocks the
two things that make testing bearable:

- a **text input box** in Parts 2 and 3, so you can "speak" by typing — no microphone needed
- an **adjustable prep timer** — drag it to 0 to skip the 15-minute wait

Then:

1. Set prep to 0 minutes, click **Commencer l'oral**
2. Tick both consent boxes → **J'accepte, commencer**
3. **Démarrer la préparation** → you'll see the stimulus and the 10-bullet notepad
4. **Je suis prêt** → Part 1 starts recording. Click **J'ai terminé ma présentation** to move on
5. Parts 2 and 3: the examiner asks a question, you type an answer, it asks another
6. In **Part 3**, click **Terminer la session** → scoring runs → you land on the report

### What "working" looks like in mock mode

- **You will hear nothing.** The mock examiner emits 300 ms of silence, not speech. The
  captions are the signal that it's working — the audio pipeline is being exercised, it just
  has nothing audible to play.
- The score report shows **8 / 4 / 4 / 4 = 20/30** every time. Those are fixtures, not a
  judgement of what you typed. The uncertainty note says so.
- Your typed answers should appear in the transcript on the report page. **If they don't,
  something is broken** — that's the single most useful thing to check, because it's the
  path that carries student speech into the scorer.

### One gotcha

Clicking **Terminer la session** during **Part 2** abandons the session with no report
(only Part 3 triggers scoring). Either let Part 2 run out its 5-minute timer, or click
through to Part 3 before ending. This is a known rough edge, not a misconfiguration.

---

## Path B — Real examiner (Gemini key + microphone)

### 1. Credentials you need

| What | Where | Cost |
|---|---|---|
| **Gemini API key** | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Free tier available; Live API usage is metered |
| **Postgres** | Supabase project, or local Docker | Free |
| **Supabase Storage** (optional) | Same project → private bucket `session-audio` | Free |

That's the whole list — there is no separate speech-to-text or text-to-speech key. Gemini
Live does audio in, transcription, question generation and audio out in one connection.

Sign in to AI Studio with a Google account, click **Get API key** → **Create API key**, and
copy it. A key from the free tier is enough to test; the Live API has low rate limits there,
so if you get 429s during a demo that's the tier, not your code.

### 2. Add it to `.env`

```
GEMINI_API_KEY="AIza..."
GEMINI_LIVE_MODEL="gemini-3.1-flash-live-preview"
GEMINI_SCORING_MODEL="gemini-3.5-flash"
```

Setting the key is what switches the app out of mock mode. Make sure `EXAMINER_MODE` is
**not** set to `mock`, or it will stay on the canned examiner.

### 3. Preflight — do this before anything else

```bash
npm run check:gemini
```

This takes about fifteen seconds, needs no database and no microphone, and tells you
whether the key works, whether both model names still resolve, and how long the examiner
takes to start speaking:

```
Scoring model: gemini-3.5-flash
  ✓ responded in 412ms with valid JSON

Live model: gemini-3.1-flash-live-preview
  ✓ connected and streamed 138240 bytes of audio
  ✓ time to first audio: 890ms (within the 2.5s PRD target)
  ✓ examiner said: "Bonjour, je suis votre examinateur pour cet oral."

Both models reachable. Safe to run the app with a real examiner.
```

If this fails, the app will fail the same way but ten minutes later and less legibly. Fix
it here first.

**404 / "model not found"** means the model name has been retired — Live models are
preview-tier and get rotated often. Try the fallback
`gemini-2.5-flash-native-audio-preview-12-2025`, and check the
[deprecations page](https://ai.google.dev/gemini-api/docs/deprecations) for what's current.

### 4. Confirm the running server agrees

```bash
npm run dev
curl http://localhost:3001/api/health
# {"status":"ok","examinerMode":"gemini"}
```

`"examinerMode":"mock"` means the key isn't being read — check that `.env` is at the repo
root, not in `apps/server/`.

### 5. Microphone

The browser will prompt for mic permission when Part 1 starts. Notes:

- **Use Chrome.** The mic path uses `ScriptProcessorNode`, which is deprecated; Chrome is
  the most forgiving. Safari and iPad are unverified.
- **`localhost` is fine** — `getUserMedia` requires a secure context, and browsers treat
  `localhost` as one. If you expose the dev server on your LAN to test from a phone, it
  will need HTTPS or the mic silently won't start.
- If you've denied permission once, Chrome remembers. Reset it via the icon at the left of
  the address bar.

### Testing notes

- **Use headphones.** The mic stays open while the examiner speaks. On speakers, its own
  voice can be picked up and fed back as if you said it — you'll see the examiner's words
  appear in the transcript attributed to the student.
- Run it in **practice mode** first and tick **Afficher le texte des questions**, so you can
  read what the examiner asked while debugging. Exam mode hides it by design.
- You can speak English to test the plumbing, but the examiner is instructed to reply only
  in French — that's intended, not a bug.
- A full run is 15 min prep + 4 + 5 + 6 minutes. For a demo, use practice mode with prep at
  0, keep Part 1 short, and let Parts 2 and 3 run only a couple of turns each before ending
  from Part 3.

### First real run — what to check, in order

1. **Does the examiner speak?** If the preflight passed but you hear nothing here, the
   problem is browser audio playback, not Gemini.
2. **Does your speech appear in the live captions?** That's `inputTranscription` arriving.
3. **Does the report's transcript contain your answers?** That's the turn-buffering fix.
   Captions working but transcript empty means segments aren't being marked final.
4. **Do the marks cite things you actually said?** If the quotes look invented, the scorer
   isn't receiving the transcript — check step 3 first.
5. **Does the examiner wait for you to finish?** If it fires a second question immediately,
   turn-taking has regressed.

### What to watch for

| Symptom | Likely cause |
|---|---|
| Examiner asks a second question immediately, without waiting | Turn-taking regression — check `GeminiExaminerService.onmessage` |
| Report cites no student speech | Transcript never marked final — the bug fixed in `9cebc06`; check `flushStudentTurn` |
| Long gap before the examiner replies | Latency. PRD target is under 2.5 s; this is the M0 spike that's still unmeasured |
| Transcript full of one- or two-word rows | Turn buffering not flushing on the right boundary |

---

## Automated checks

These need no database and no keys, and are the fastest way to know you haven't broken
anything:

```bash
npm test                # 27 tests across server + shared
npm run typecheck       # tsc across all three workspaces
npm run verify:stimuli  # licence allow-list, file existence, theme coverage
npm run check:gemini    # key + both model names + latency (needs GEMINI_API_KEY)
```

`npm test` is worth running before every commit — the state machine, WS contract, scoring
guardrails and transcript buffering are all covered.

---

## Production build check

Confirms the single-service setup serves the SPA and API from one origin:

```bash
npm run build
NODE_ENV=production npm start
```

Open <http://localhost:3001> — the app should load from the server directly, with no Vite
dev server running.

---

## Troubleshooting

**`Environment variable not found: DIRECT_URL`** — you're on a build from before
`apps/server/prisma.config.ts` existed. Pull latest. `DIRECT_URL` is now optional and the
root `.env` is found from the workspace.

**`Could not find Prisma Schema`** — run Prisma via the workspace script
(`npm run db:deploy --workspace=apps/server`) rather than `npx prisma` from the repo root.
The config file lives in `apps/server`.

**`Can't reach database server`** — check the container is up (`docker ps`) or, on Supabase,
that you copied the connection string with the password substituted in; the dashboard shows
`[YOUR-PASSWORD]` as a placeholder.

**Migrations hang or fail on Supabase** — you're running them through the pooled URL. Set
`DIRECT_URL` to the port-5432 connection string.

**`prisma generate` fails on install** — needs network access to `binaries.prisma.sh` to
fetch its query engine. Behind a proxy or firewall, that's the thing to allow.

## Known limits of this guide

Verified: the test suite, the typecheck, the web production build, the stimulus verifier,
and that `check-gemini.ts` compiles and handles a missing or bad key correctly.

**Not** verified: anything requiring a database or a live Gemini connection. Prisma's engine
download and `generativelanguage.googleapis.com` are both blocked in the environment this
was written in. So `db:deploy`, first boot, and the entire real-examiner path are untested
from my side — they're reasoned from the API docs, not observed. `npm run check:gemini` is
the fastest way to find out if that reasoning holds.
