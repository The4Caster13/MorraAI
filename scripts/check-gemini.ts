/**
 * Gemini preflight check.
 *
 * Verifies, without touching the database or a microphone, that:
 *   1. GEMINI_API_KEY is present and accepted
 *   2. the scoring model returns schema-valid structured output
 *   3. a Live model connects AND actually streams audio back
 *
 * Point 3 is the one that matters: a Live model can happily return a transcript
 * of speech it never sends, which looks like success and leaves the examiner
 * mute. When the configured model does that, this probes known alternatives and
 * tells you which to use.
 *
 * Also reports time-to-first-audio, the latency the PRD gates on (<2.5s).
 *
 * Usage:  npm run check:gemini
 */

import "dotenv/config";
import { GoogleGenAI, Modality } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY;
const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL ?? "gemini-3.1-flash-live-preview";
const SCORING_MODEL = process.env.GEMINI_SCORING_MODEL ?? "gemini-3.5-flash";
const LIVE_TIMEOUT_MS = 25_000;
/** Audio can trail the turn-complete marker; don't call silence too early. */
const TRAILING_AUDIO_GRACE_MS = 3000;

/** Tried in order when the configured model returns no audio. */
const FALLBACK_LIVE_MODELS = [
  "gemini-2.5-flash-native-audio-preview-12-2025",
  "gemini-3.1-flash-live-preview",
  "gemini-live-2.5-flash-preview",
];

function ok(msg: string) {
  console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
}
function fail(msg: string) {
  console.error(`  \x1b[31m✗\x1b[0m ${msg}`);
}
function warn(msg: string) {
  console.error(`  \x1b[33m!\x1b[0m ${msg}`);
}
function info(msg: string) {
  console.log(`  \x1b[2m${msg}\x1b[0m`);
}

/** Models sometimes wrap structured output in a markdown fence despite the mime type. */
function stripCodeFence(text: string): string {
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : text;
}

interface LiveProbeResult {
  model: string;
  audioBytes: number;
  firstAudioMs: number | null;
  transcript: string;
  fieldsSeen: string[];
  messageCount: number;
  error?: string;
}

/**
 * Opens a Live session, says hello, and measures what comes back.
 *
 * Resolves rather than throws on failure: the caller wants to compare several
 * models, not stop at the first disappointment.
 */
async function probeLiveModel(
  ai: GoogleGenAI,
  model: string,
  withVoice: boolean,
): Promise<LiveProbeResult> {
  return new Promise<LiveProbeResult>((resolve) => {
    const started = Date.now();
    const fieldsSeen = new Set<string>();
    let audioBytes = 0;
    let firstAudioMs: number | null = null;
    let transcript = "";
    let messageCount = 0;
    let settled = false;
    let graceTimer: NodeJS.Timeout | null = null;

    const done = (error?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (graceTimer) clearTimeout(graceTimer);
      resolve({
        model,
        audioBytes,
        firstAudioMs,
        transcript: transcript.trim(),
        fieldsSeen: [...fieldsSeen],
        messageCount,
        error,
      });
    };

    const timer = setTimeout(
      () => done(`no response within ${LIVE_TIMEOUT_MS / 1000}s`),
      LIVE_TIMEOUT_MS,
    );

    void ai.live
      .connect({
        model,
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
          // Some Live models only synthesise audio once a voice is chosen.
          ...(withVoice
            ? { speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } } }
            : {}),
          systemInstruction:
            "Tu es un examinateur de français. Réponds en une seule phrase courte, en français.",
        },
        callbacks: {
          onmessage: (message) => {
            messageCount += 1;
            for (const [key, value] of Object.entries(message)) {
              if (value !== undefined && value !== null) fieldsSeen.add(key);
            }

            const inline = message.data;
            if (inline) {
              if (firstAudioMs === null) firstAudioMs = Date.now() - started;
              audioBytes += Buffer.from(inline, "base64").length;
            }

            const content = message.serverContent;
            if (!content) return;
            for (const key of Object.keys(content)) fieldsSeen.add(`serverContent.${key}`);
            if (content.outputTranscription?.text) transcript += content.outputTranscription.text;

            if (content.turnComplete) {
              if (graceTimer) clearTimeout(graceTimer);
              graceTimer = setTimeout(() => done(), TRAILING_AUDIO_GRACE_MS);
            }
          },
          onerror: (e: ErrorEvent) => done(e.message || "live socket error"),
          onclose: () => done(),
        },
      })
      .then((session) => {
        session.sendClientContent({
          turns: [
            { role: "user", parts: [{ text: "Bonjour, présentez-vous en une phrase." }] },
          ],
          turnComplete: true,
        });
      })
      .catch((err: unknown) => done(err instanceof Error ? err.message : String(err)));
  });
}

function reportProbe(r: LiveProbeResult): boolean {
  if (r.error) {
    fail(`${r.model}: ${r.error}`);
    return false;
  }
  if (r.transcript) info(`said: "${r.transcript.slice(0, 70)}"`);
  if (r.audioBytes === 0) {
    warn(`${r.model}: transcript but 0 bytes of audio across ${r.messageCount} messages`);
    if (!r.fieldsSeen.includes("serverContent.modelTurn")) {
      info("no serverContent.modelTurn — the model never sent audio parts at all");
    }
    return false;
  }
  const seconds = r.audioBytes / (24000 * 2);
  ok(`${r.model}: ${r.audioBytes} bytes (~${seconds.toFixed(1)}s of speech)`);
  if (r.firstAudioMs !== null) {
    const verdict = r.firstAudioMs <= 2500 ? "\x1b[32mwithin\x1b[0m" : "\x1b[33mover\x1b[0m";
    ok(`time to first audio: ${r.firstAudioMs}ms (${verdict} the 2.5s target)`);
  }
  return true;
}

async function main(): Promise<number> {
  if (!API_KEY) {
    fail("GEMINI_API_KEY is not set.");
    console.error("\n  Add it to .env at the repo root:");
    console.error('    GEMINI_API_KEY="..."');
    console.error("\n  Get a key at https://aistudio.google.com/apikey");
    return 1;
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  let failures = 0;

  // ---- 1. Scoring model -----------------------------------------------------

  console.log(`\nScoring model: ${SCORING_MODEL}`);
  try {
    const started = Date.now();
    // Uses responseSchema, exactly as the real scoring call does — a freeform
    // "reply with JSON" prompt tests prompt obedience rather than the API path.
    const response = await ai.models.generateContent({
      model: SCORING_MODEL,
      contents: "Donne une note d'exemple pour un oral de français.",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            mark: { type: "integer", minimum: 0, maximum: 12 },
            justification: { type: "string" },
          },
          required: ["mark", "justification"],
        } as never,
      },
    });
    const text = (response.text ?? "").trim();
    if (!text) throw new Error("Model returned an empty response");
    const parsed = JSON.parse(stripCodeFence(text)) as { mark?: unknown };
    if (typeof parsed.mark !== "number") {
      throw new Error(`Structured output did not match the schema: ${text.slice(0, 120)}`);
    }
    ok(`responded in ${Date.now() - started}ms with schema-valid JSON`);
  } catch (err) {
    failures += 1;
    fail(err instanceof Error ? err.message : String(err));
    console.error("\n  If this is a 404, the model name is wrong or retired.");
    console.error("  Check https://ai.google.dev/gemini-api/docs/deprecations");
  }

  // ---- 2. Live model, with fallbacks ---------------------------------------

  console.log(`\nLive model: ${LIVE_MODEL}`);
  let working: string | null = null;

  if (reportProbe(await probeLiveModel(ai, LIVE_MODEL, false))) {
    working = LIVE_MODEL;
  } else {
    // A model that transcribes but doesn't speak sometimes just needs a voice.
    console.log(`\n  Retrying ${LIVE_MODEL} with an explicit voice…`);
    if (reportProbe(await probeLiveModel(ai, LIVE_MODEL, true))) {
      working = LIVE_MODEL;
      console.log(
        `\n  \x1b[33mThis model needs an explicit voice. Already applied in GeminiExaminerService.\x1b[0m`,
      );
    }
  }

  if (!working) {
    console.log("\n  Probing alternative Live models…");
    for (const candidate of FALLBACK_LIVE_MODELS) {
      if (candidate === LIVE_MODEL) continue;
      if (reportProbe(await probeLiveModel(ai, candidate, true))) {
        working = candidate;
        break;
      }
    }
  }

  if (working && working !== LIVE_MODEL) {
    console.log(`\n  \x1b[32mUse this model — put it in .env:\x1b[0m`);
    console.log(`    GEMINI_LIVE_MODEL="${working}"`);
  } else if (!working) {
    failures += 1;
    console.error("\n  No Live model returned audio.");
    console.error("  The app still works with question text shown — the examiner");
    console.error("  falls back to text automatically when no audio arrives.");
    console.error("  Check https://ai.google.dev/gemini-api/docs/deprecations");
  }

  // ---- Result ---------------------------------------------------------------

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.\n`);
    return 1;
  }
  console.log("\nAll checks passed. Safe to run the app with a real examiner.\n");
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    fail(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
