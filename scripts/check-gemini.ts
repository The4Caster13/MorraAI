/**
 * Gemini preflight check.
 *
 * Verifies, in about fifteen seconds and without touching the database or a
 * microphone, that:
 *   1. GEMINI_API_KEY is present and accepted
 *   2. the scoring model responds and returns JSON
 *   3. the Live model accepts a WebSocket connection and streams audio back
 *
 * It also reports time-to-first-audio, which is the latency number the PRD
 * gates on (<2.5s after the student stops speaking).
 *
 * Usage:  npm run check:gemini
 */

import "dotenv/config";
import { GoogleGenAI, Modality } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY;
const LIVE_MODEL =
  process.env.GEMINI_LIVE_MODEL ?? "gemini-3.1-flash-live-preview";
const SCORING_MODEL = process.env.GEMINI_SCORING_MODEL ?? "gemini-3.5-flash";
const LIVE_TIMEOUT_MS = 20_000;

function ok(msg: string) {
  console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
}
function fail(msg: string) {
  console.error(`  \x1b[31m✗\x1b[0m ${msg}`);
}
function warn(msg: string) {
  console.error(`  \x1b[33m!\x1b[0m ${msg}`);
}

/** Models sometimes wrap structured output in a markdown fence despite the mime type. */
function stripCodeFence(text: string): string {
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : text;
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

  // ---- 2. Live model --------------------------------------------------------

  console.log(`\nLive model: ${LIVE_MODEL}`);
  try {
    await new Promise<void>((resolve, reject) => {
      const started = Date.now();
      let audioBytes = 0;
      let firstAudioMs: number | null = null;
      let transcript = "";
      let settled = false;
      let messageCount = 0;
      const fieldsSeen = new Set<string>();
      let graceTimer: NodeJS.Timeout | null = null;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error(`No response within ${LIVE_TIMEOUT_MS / 1000}s`));
      }, LIVE_TIMEOUT_MS);

      const finish = (err?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (graceTimer) clearTimeout(graceTimer);
        if (err) return reject(err);

        if (transcript.trim()) ok(`examiner said: "${transcript.trim().slice(0, 80)}"`);

        if (audioBytes === 0) {
          // Without audio the examiner is mute — the whole premise of a spoken
          // exam. Report the message shape so the cause is identifiable.
          warn(`connected, but received 0 bytes of audio across ${messageCount} messages`);
          warn(`fields seen: ${[...fieldsSeen].join(', ') || '(none)'}`);
          return reject(
            new Error('The Live model returned a transcript but no audio — the examiner would be silent.'),
          );
        }

        const seconds = audioBytes / (24000 * 2);
        ok(`streamed ${audioBytes} bytes of audio (~${seconds.toFixed(1)}s at 24kHz)`);
        if (firstAudioMs !== null) {
          const verdict =
            firstAudioMs <= 2500
              ? "\x1b[32mwithin\x1b[0m"
              : "\x1b[33mover\x1b[0m";
          ok(
            `time to first audio: ${firstAudioMs}ms (${verdict} the 2.5s PRD target)`,
          );
        }
        resolve();
      };

      void ai.live
        .connect({
          model: LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            outputAudioTranscription: {},
            systemInstruction:
              "Tu es un examinateur de français. Réponds en une seule phrase courte, en français.",
          },
          callbacks: {
            onmessage: (message) => {
              messageCount += 1;
              for (const [key, value] of Object.entries(message)) {
                if (value !== undefined && value !== null) fieldsSeen.add(key);
              }

              // The SDK's `data` getter concatenates every inline-data part, so
              // it catches audio wherever in the parts array it lands.
              const inline = message.data;
              if (inline) {
                if (firstAudioMs === null) firstAudioMs = Date.now() - started;
                audioBytes += Buffer.from(inline, "base64").length;
              }

              const content = message.serverContent;
              if (!content) return;
              for (const key of Object.keys(content)) fieldsSeen.add(`serverContent.${key}`);

              const outputText = content.outputTranscription?.text;
              if (outputText) transcript += outputText;

              if (content.turnComplete) {
                // Audio can trail the turn-complete marker, so allow a grace
                // period rather than declaring silence the instant it arrives.
                if (graceTimer) clearTimeout(graceTimer);
                graceTimer = setTimeout(() => finish(), 2500);
              }
            },
            onerror: (e: ErrorEvent) =>
              finish(new Error(e.message || "Live socket error")),
            onclose: () => {
              if (!settled)
                finish(
                  audioBytes > 0
                    ? undefined
                    : new Error("Closed with no audio"),
                );
            },
          },
        })
        .then((session) => {
          session.sendClientContent({
            turns: [
              {
                role: "user",
                parts: [{ text: "Bonjour, présentez-vous en une phrase." }],
              },
            ],
            turnComplete: true,
          });
        })
        .catch((err: unknown) =>
          finish(err instanceof Error ? err : new Error(String(err))),
        );
    });
  } catch (err) {
    failures += 1;
    fail(err instanceof Error ? err.message : String(err));
    console.error(
      '\n  If this is a 404 or "model not found", try the fallback:',
    );
    console.error(
      '    GEMINI_LIVE_MODEL="gemini-2.5-flash-native-audio-preview-12-2025"',
    );
    console.error(
      "  Live models are preview-tier and get retired often — check",
    );
    console.error("  https://ai.google.dev/gemini-api/docs/deprecations");
  }

  // ---- Result ---------------------------------------------------------------

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.\n`);
    return 1;
  }
  console.log(
    "\nBoth models reachable. Safe to run the app with a real examiner.\n",
  );
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    fail(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
