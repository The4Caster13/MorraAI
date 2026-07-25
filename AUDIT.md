# Morrai — code audit against the PRD

**Date:** 25 July 2026
**Commit audited:** `d579dd4` (pre-fix) → `9cebc06` (post-fix)
**Scope:** every source file in `apps/server`, `apps/web`, `packages/shared`, `scripts`, `data`

---

## Verdict

The architecture is sound and the PRD is faithfully reflected in the *shape* of the code —
the state machine, the WS contract, the `ExaminerService` abstraction and the rubric
descriptors are all real, thought-through work, not scaffolding. Roughly 60% of the PRD's
P0 surface is genuinely implemented.

But before this audit the repo **did not compile**, and with a real Gemini key it would
have produced score reports built on an empty transcript. Both are now fixed. What remains
between here and a defensible deployment is mostly *substance* rather than structure:
authentication, the delivery-analysis layer, real stimulus images, and a scoring-validity
study.

---

## What is genuinely right

**The exam model is faithful.** `sessionMachine.ts` encodes the real IO as an explicit
transition table with `DRAFT → CONSENTED → PREP → PART1_INTRO → PART1_RECORDING →
PART1_CLOSING → PART2_QA → PART3_QA → SCORING → COMPLETE`, and illegal transitions throw
rather than silently corrupting state. Phase caps (240s / 300s / 360s) match the PRD's
3–4 / 4–5 / 5–6 minute windows. The 10-bullet notepad limit is enforced in the Zod schema,
in the DB type and in the UI. Part 1 hard-stops at 4:00 with an examiner courtesy line, as
a real examiner would.

**The provider abstraction is real.** `ExaminerService` is a genuine interface with two
working implementations. `MockExaminerService` gives a fully clickable app with no API key
— including a typed-text path so the whole flow can be exercised without a microphone —
and the factory in `examiner/index.ts` swaps implementations on a single env var. PRD §6.2
asked for exactly this and got it.

**The IB-copyright and disclaimer constraints are handled carefully.** `rubricDescriptors.ts`
is original paraphrase, band labels are invented (`Emerging`/`Developing`/`Proficient`/
`Strong`) rather than IB wording, and `DISCLAIMER_FR` is surfaced on the setup page and the
report. The scoring persona explicitly instructs the model that it is not an IB examiner.
PRD §6.4's hardest compliance constraints are respected.

**Consent is modelled properly, not bolted on.** `ConsentRecord` is a first-class table with
a versioned consent text; the WS gateway refuses to open a non-DRAFT session without it;
deletion cascades to transcript, audio rows and object storage. The consent copy itself is
specific and age-aware. This is better than most production apps manage.

**Scoring arithmetic is not trusted to the model.** `scoreAndPersist` recomputes the total
server-side from the four criterion marks. Small thing, exactly right.

**Types are shared end-to-end.** One Zod-defined WS contract in `packages/shared`, validated
on *both* sides of the socket. Malformed client messages get a typed error rather than
crashing the runtime.

**The test suite tests behaviour, not implementation.** 27 tests covering state transitions,
the WS contract, scoring-prompt guardrails (including an IB-verbatim denylist), examiner
flow, transcript buffering and WAV encoding. All pass.

---

## What was broken (now fixed)

### 1. The repo did not compile — and the cause was a `.gitignore` bug

`SessionRuntime.ts` and `routes/sessions.ts` imported `../storage/StorageService.js` and
`../storage/pcmToWav.js`. Neither file existed in the repository.

The cause: `.gitignore` contained a bare `storage/`. In git, an unanchored directory pattern
matches at **any depth**, so it silently excluded `apps/server/src/storage/`. The files were
almost certainly written and then swallowed by git without ever appearing in `git status`.

Fixed by anchoring the pattern to `/storage/` and writing both modules:
`StorageService.ts` (private Supabase bucket, service-role key, upload/download/cascade-delete)
and `pcmToWav.ts` (44-byte canonical WAV header + duration). This class of bug is worth
remembering — check `.gitignore` first whenever a file "exists locally but not on GitHub".

### 2. With a real Gemini key, scoring would have run on an empty transcript

This was the most consequential bug, and it was invisible because mock mode papers over it.

`GeminiExaminerService` emitted every input-transcription fragment with `isFinal: false`.
`SessionRuntime` only persists a segment `if (seg.isFinal)`. Therefore **no student
utterance was ever written to the database**. The scorer would have received only examiner
turns and been asked to justify marks with quotes from a transcript containing none of the
student's speech — which, given the "always cite evidence" instruction, would have produced
either hallucinated quotes or uniformly zero marks. Either outcome silently destroys the
product's core claim.

Two related defects in the same handler: examiner `outputTranscription` fragments were each
written as a separate DB row (shredding one question into dozens of rows), and
`promptNextQuestion` fired on every `turnComplete` — including the model's own — so the
examiner would answer itself and fire questions back-to-back without waiting for the student.

Fixed by buffering both directions and flushing at turn boundaries: the student's turn
closes when the model takes the floor, the examiner's when `turnComplete` arrives, and
anything mid-utterance is salvaged on close. Part 1 is a 3–4 minute monologue with no
examiner turn to close it, so it additionally segments on sentence boundaries. The
redundant re-prompt is gone — Gemini Live's own voice-activity detection handles turn-taking,
which also gets PRD §5.4's barge-in requirement for free. Six tests lock this in.

### 3. Any session ID granted full read and delete

`GET /api/sessions/:id`, `/transcript`, `/audio/...` and `DELETE /api/sessions/:id` performed
**no ownership check whatsoever**. A session ID — which appears in the URL bar — was enough
to read another student's transcript and marks, or delete their recording. The WS endpoint
was equally open.

Now every session-scoped route requires a `userId` that matches the session owner.

**This is ownership, not authentication** — see the open items below.

### 4. It could not be deployed

- `build` was `tsc --noEmit`: a typecheck producing no artifact. There was no `start` script.
- No committed Prisma migration, so `prisma migrate deploy` had nothing to apply, and the
  README pointed at `migrate dev`, which is interactive and dev-only.
- No `prisma generate` on install — a fresh clone fails to typecheck before it fails to run.
- No Dockerfile, and no answer for how the SPA reaches the API in production (the Vite proxy
  is dev-only; `cors: { origin: true }` reflects any origin).

Now: committed initial migration + `migration_lock.toml`, `postinstall: prisma generate`,
a `start` script, single-origin static SPA serving under `NODE_ENV=production`, locked-down
CORS, and a Dockerfile. Migrations are deliberately a separate step from container boot so a
crash-looping deploy cannot half-apply a schema change.

---

## What is still missing

### Blockers before real students use it

**Authentication.** `userId` is a UUID the browser generates in `localStorage`. The ownership
checks stop session-ID leakage, but anyone who learns a `userId` can act as that user, and
clearing browser storage orphans a student's entire history. For an app recording the voices
of 16–18-year-olds under GDPR, self-asserted identity is not defensible. Supabase Auth is
already a dependency — magic-link or school-SSO sign-in is a day of work and replaces the
whole `profile.ts` shim.

**Real stimulus images.** All 25 are generated placeholder SVGs reading "PLACEHOLDER — À
REMPLACER". PRD §5.1 P0 requires licensed images with attribution, human-reviewed before
students see them. `verify-stimuli.ts` enforces a license allow-list and theme coverage —
good — but the allow-list currently includes `Placeholder`, which defeats the check in
production. Remove `Placeholder` from `ALLOWED_LICENSES` once real images land, so the
verifier fails loudly if a placeholder survives. There is also no admin review panel (P1);
today "human review" means hand-editing `manifest.json`.

**No rate limiting or spend cap.** With a live `GEMINI_API_KEY`, `POST /api/sessions` is
unauthenticated and unbounded. Each session is ~15 minutes of realtime multimodal audio.
One script could run up a serious bill. Add a per-user daily session cap and a global
concurrency limit before the key goes anywhere public.

### Substantive PRD gaps

**Delivery analysis (§5.3) does not exist.** The PRD calls for speech rate, pause frequency
and length, filler words, self-corrections and intonation. None is implemented.
`SessionRuntime.competenceEstimate` is a heuristic over average utterance length plus five
tense-marker regexes. That signal drives question difficulty (§5.4) and is supposed to feed
Criterion A. It is the largest gap between the PRD and the code, and the most likely reason
AI marks would diverge from teacher marks.

Related: `transcriptRepo.add` writes `startMs === endMs` for every segment, so there is no
timing data to compute any of this from — and because `sessionStartMs` is set at prep start,
the offsets include the 15-minute prep window. Word-level timestamps (§5.2 P1) are the
prerequisite; the PRD's optional Python microservice is the natural home for the rest.

**Confidence-aware scoring is dead code.** Gemini's transcription returns no confidence, so
`sttConfidence` is always `null`, the low-confidence path never triggers, and the §5.5 P0
uncertainty note plus the mitigation for Risk #2 (learner-accent STT) never fire in practice.
The plumbing is all there and correct — it just has nothing to consume. Either source
confidence from a different STT provider or replace it with a proxy signal.

**Evidence citation is not actually enforced.** The README says "structurally-enforced
transcript citation", but the only structural check is `evidenceQuotes.length >= 1`. A
fabricated quote passes. PRD §6.4 says "every scoring justification must cite the transcript".
Fix is cheap and high-value: after parsing the score response, verify each quote is a
substring of the transcript and reject or flag the result otherwise.

**Audio quality choices will hurt the WER target.** `micCapture.ts` downsamples to 16 kHz by
nearest-neighbour sample-dropping with no low-pass filter, which aliases and directly
degrades transcription accuracy — working against the ≤15% WER goal on accented learner
French. It also uses `ScriptProcessorNode`, deprecated and main-thread, which will glitch
under load and is unreliable on iPad Safari (a platform the PRD explicitly targets).
Moving to `AudioWorklet` with a proper resampler addresses both.

**Echo path.** The mic runs continuously through Parts 2 and 3 while examiner audio plays
from the speakers. Browser AEC is the only thing preventing the examiner's own voice from
being fed back to Gemini as student speech. Headphones will be fine; a laptop in a classroom
may not be. Worth testing early.

### Correctness and robustness

- **Ending early mid-Part-2 discards everything.** `endSessionEarly` only scores from
  `PART3_QA`; from `PART2_QA` it marks the session `ABANDONED` with no report. A student who
  stops after 12 minutes loses the whole attempt. Scoring whatever exists, with an
  uncertainty note, would be kinder and is what the rubric engine is already built for.
- **No minimum for Part 1.** A student can end the presentation after ten seconds and still
  reach a Criterion B1 mark.
- **Sessions do not survive a server restart** (PRD §6.5 requires resuming mid-phase).
  Runtime state is in-memory; `markStaleActiveSessionsErrored` marks everything active as
  `ERROR` on boot — and being unscoped, in a multi-instance deployment one restarting
  instance would kill live sessions on every other instance. Browser refresh is fine.
- **Unbounded in-memory audio.** Phase audio accumulates in `Buffer[]` until phase close —
  roughly 8 MB per phase per session. Fine for one user; a memory ceiling under concurrency.
- **Duplicated consent version.** `CONSENT_TEXT_VERSION` is declared in both
  `ConsentPage.tsx` and `routes/sessions.ts`; the client's value is ignored. Move it to
  `packages/shared` before the two drift.

### Not started (acknowledged in the PRD)

PDF export (§5.6 P1), admin stimulus panel (§5.1 P1), the error-log table (§5.5 P1),
per-criterion progress charts (§5.5 P1 — only a total-score bar chart exists), teacher
dashboard, HL mode, billing.

---

## Suggested order of work

1. **Authentication** (Supabase Auth) — gates everything else involving real students.
2. **Quote verification in the scoring engine** — cheap, and it's a stated hard constraint.
3. **Rate limiting + spend cap** — before the Gemini key is exposed to any public URL.
4. **Real licensed stimuli** + drop `Placeholder` from the verifier allow-list.
5. **M0 latency spike with a real key** — the PRD's own gate, still unmeasured. Everything
   about the adaptive loop assumes it passes.
6. **AudioWorklet + proper resampling** — unblocks the WER target and iPad support.
7. **Delivery metrics** (word timestamps → speech rate, pauses, fillers) — the real §5.3.
8. **Scoring validation study** vs. two teachers on 30 recordings — the PRD's central
   success metric, and the only thing that tells you whether any of the above worked.

Steps 1–4 are roughly a week. Step 8 is what turns this from a working demo into something a
student should trust.
