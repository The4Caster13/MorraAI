# Deploying Morrai to Railway

The app deploys as a **single service**. One container runs Fastify, which serves the REST
API, the WebSocket gateway and the built React app from the same origin — so there is no
CORS or proxy configuration to get wrong, and no second service to keep in sync.

Two things it needs from the host that a static host cannot give you:

- **A long-lived process.** Session state (timers, the Gemini Live connection, audio
  buffers) lives in memory for the length of an exam. Serverless functions are killed
  between requests, so Vercel and Netlify cannot run the server.
- **WebSockets.** The whole exam runs over one socket.

It also needs **HTTPS**, which Railway provides automatically. This is not optional:
browsers refuse `getUserMedia` on insecure origins, so on plain HTTP the microphone never
starts and the app is unusable.

---

## Before you start

You need:

| | |
|---|---|
| A GitHub repo | Already have it |
| A Supabase database | Already have it — the deployment reuses it |
| A Gemini API key | Already have it |
| An access code | Invent one now, e.g. `morrai-demo-2026` |

---

## 1. Create the service

1. Go to [railway.app](https://railway.app) and sign in with GitHub.
2. **New Project** → **Deploy from GitHub repo** → pick `The4Caster13/MorraAI`.
3. Railway reads `railway.json`, sees `"builder": "DOCKERFILE"`, and builds the image.

The first build takes 3–5 minutes. It will fail to *start* until you finish step 2 — that's
expected, since the server refuses to boot without a database URL.

## 2. Set the environment variables

**Variables** tab → **Raw Editor** → paste, substituting your own values:

```
NODE_ENV=production
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-ca-central-1.pooler.supabase.com:5432/postgres
GEMINI_API_KEY=<your key>
GEMINI_LIVE_MODEL=gemini-3.1-flash-live-preview
GEMINI_SCORING_MODEL=gemini-3.5-flash
GEMINI_VOICE=Kore
ACCESS_CODE=<the code you invented>
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
SUPABASE_AUDIO_BUCKET=session-audio
```

Copy `DATABASE_URL` from your local `.env` — it is the same database.

**Do not set `PORT`.** Railway injects it, and the server reads it.

### Why the Supabase Storage variables matter here

Locally, audio is written to `storage/` on disk. Railway's filesystem is **ephemeral**: it
is wiped on every deploy and restart. Scoring still works, because it reads the recording
back moments after the session ends, but past recordings vanish and the report's replay
breaks. Setting the two Supabase variables moves audio into your existing project's storage
instead.

Create the bucket first: Supabase dashboard → **Storage** → **New bucket** → name it
`session-audio` → **keep it private**. It holds student voice recordings and is only ever
read through the API, which checks ownership first.

If you leave these unset the app still runs, and the boot log warns you.

## 3. Generate the public URL

**Settings** → **Networking** → **Generate Domain**.

You'll get something like `morrai-production.up.railway.app`, with HTTPS already set up.

## 4. Check it started

**Deployments** → click the latest → **View Logs**. You want:

```
18 stimuli available
Morrai server ready — examiner: gemini, audio storage: Supabase
```

Then visit `https://<your-domain>/api/health`, which should return:

```json
{"status":"ok","examinerMode":"gemini"}
```

## 5. Try it

Open the domain, enter your access code when prompted, and run a session.

---

## The database is shared with local development

The deployment points at the same Supabase project you develop against. That is the
simplest setup and it is already migrated — but it means **a session you delete locally is
deleted for everyone**, and schema changes take effect immediately in production.

If you'd rather separate them, create a second Supabase project, point `DATABASE_URL` at it,
and read the migration warning below first.

## Applying migrations later

The container deliberately does **not** migrate on boot. A crash-looping deploy that
half-applies a schema change is much worse than one that starts with an old schema. Run
migrations yourself, from your machine, against the production `DATABASE_URL`:

```bash
npm run db:deploy --workspace=apps/server
npm run db:seed --workspace=apps/server
```

> **Known issue.** `20260725120000_exam_timings` sorts before `20260725150132_init`, but it
> alters a table `init` has not created yet. Migrating a *brand new* database from these
> files therefore fails. The existing database is unaffected. Fix before you ever need a
> fresh environment: fold the correct `presentationSecondsCap` default into `init` and
> delete the orphaned migration — on a database you are willing to rebuild, since Prisma
> checksums applied migrations and will reject edits to them.

## What the access code does and doesn't do

`ACCESS_CODE` gates **session creation**, which is the only route that reaches Gemini. A
WebSocket needs a session ID that already exists and passes an ownership check, so gating
creation closes the whole path.

It is a shared password, not authentication. It stops strangers and crawlers finding your
URL and spending your Gemini budget. It does not stop someone you gave the code to from
running many sessions, and it does not identify users — identity is still a UUID in the
browser's `localStorage`. Real accounts are the next step if this goes to actual students.

Set a spend limit in Google AI Studio regardless.

## Redeploying

Every push to `main` triggers a build. To roll back, open **Deployments** and redeploy an
earlier one.

## Troubleshooting

**Build fails at `npm ci`** — check `package-lock.json` is committed and in sync. Run
`npm install` locally and commit any change.

**Starts then immediately exits** — read the logs. The server prints the offending variable
and why on a configuration problem, rather than a stack trace.

**"Cannot reach the database server"** — Railway needs the pooled Supabase URL. Confirm
`DATABASE_URL` is set in Railway's variables, not only in your local `.env`, which is not
deployed.

**The microphone never starts** — confirm the URL is `https://`. Browsers block microphone
access on insecure origins with no visible error beyond a permission failure.

**The examiner is silent** — run `npm run check:gemini` locally with the same key. If audio
works locally but not deployed, check `GEMINI_API_KEY` reached Railway.

**Images 404** — run the seed against the production database (see above).
