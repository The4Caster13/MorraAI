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
# DIRECT_URL="postgresql://postgres:parlons@localhost:5432/postgres"
```

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

Everything above, plus:

```
GEMINI_API_KEY="..."
```

Restart the server. Check which examiner is live:

```bash
curl http://localhost:3001/api/health
# {"status":"ok","examinerMode":"gemini"}
```

`mock` means the key isn't being read — check that `.env` is at the repo root and that
`EXAMINER_MODE` isn't pinned.

### Testing notes

- **Use headphones.** The mic stays open while the examiner speaks. On speakers, its own
  voice can be picked up and fed back as if you said it.
- Chrome is the safest browser for the mic path. Safari and iPad are unverified.
- Exam mode hides the question text by design. In practice mode, tick **Afficher le texte
  des questions** so you can read what it asked while debugging.
- You can speak English or nonsense to test the plumbing, but the examiner is instructed to
  reply only in French — that's intended behaviour, not a bug.

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

## Known limits of this guide

The automated checks, the web production build and the typecheck have all been verified.
Booting the server end-to-end has **not** been verified in this environment — Prisma's
engine download is blocked here, so the database path is untested from my side. If
something fails at `db:deploy` or first boot, that's the least-exercised part of the setup.
