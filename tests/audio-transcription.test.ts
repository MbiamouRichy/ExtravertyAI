import assert from "node:assert/strict";
import { test } from "node:test";
import {
  transcribeAudio,
  TRANSCRIPTION_MODELS,
} from "../lib/audio-transcription";
import { prepareSummaryHistory } from "../lib/conversation-summary";
import { generateWritingAssistance } from "../lib/writing-assistance";
import { assessProspect } from "../lib/instinct-decision";

test("audio provider fallback, bounded output and shared AI context", async (t) => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.OPENROUTER_API_KEY;
  const oldModel = process.env.OPENROUTER_MODEL;
  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.OPENROUTER_MODEL = "test-chat";
  const media = { bytes: Buffer.from("OggS-test-audio"), mime: "audio/ogg" };
  try {
    await t.test(
      "Whisper success never calls Voxtral and uses the transcription endpoint",
      async () => {
        let calls = 0;
        globalThis.fetch = async (url, init) => {
          calls++;
          assert.equal(
            url,
            "https://openrouter.ai/api/v1/audio/transcriptions",
          );
          const body = JSON.parse(String(init?.body));
          assert.equal(body.model, TRANSCRIPTION_MODELS[0]);
          assert.deepEqual(body.input_audio, {
            data: media.bytes.toString("base64"),
            format: "ogg",
          });
          assert.equal(init?.redirect, "error");
          return Response.json({ text: " Je voudrais deux articles. " });
        };
        assert.deepEqual(await transcribeAudio(media), {
          text: "Je voudrais deux articles.",
          model: TRANSCRIPTION_MODELS[0],
        });
        assert.equal(calls, 1);
      },
    );
    await t.test(
      "empty, invalid and unavailable Whisper responses fall back to Voxtral",
      async () => {
        for (const first of [
          () => Response.json({ text: "  " }),
          () => Response.json({ text: 7 }),
          () => new Response("", { status: 503 }),
        ]) {
          const models: string[] = [];
          globalThis.fetch = async (_url, init) => {
            models.push(JSON.parse(String(init?.body)).model);
            return models.length === 1
              ? first()
              : Response.json({ text: "Un devis à 50 000 francs." });
          };
          const result = await transcribeAudio(media);
          assert.deepEqual(models, [...TRANSCRIPTION_MODELS]);
          assert.equal(result.model, TRANSCRIPTION_MODELS[1]);
        }
      },
    );
    await t.test(
      "account failures and invalid media do not cause duplicate paid calls",
      async () => {
        let calls = 0;
        globalThis.fetch = async () => {
          calls++;
          return new Response("", { status: 402 });
        };
        await assert.rejects(transcribeAudio(media), /TRANSCRIPTION_HTTP_402/);
        assert.equal(calls, 1);
        await assert.rejects(
          transcribeAudio({ ...media, bytes: Buffer.from("not audio") }),
          /MEDIA_INVALID/,
        );
        assert.equal(calls, 1);
      },
    );
    await t.test(
      "both models failing never yields a fabricated transcript",
      async () => {
        globalThis.fetch = async () => Response.json({ text: "" });
        await assert.rejects(
          transcribeAudio(media),
          /TRANSCRIPTION_INVALID_OR_EMPTY_RESPONSE/,
        );
      },
    );
    await t.test(
      "summary, suggestions and instinct reuse completed audio and image extraction",
      async () => {
        const audio = {
          senderType: "CLIENT",
          type: "AUDIO",
          content: "[AUDIO]",
          extractedText: "Je veux un devis pour deux sites.",
          extractionStatus: "COMPLETED",
        };
        const image = {
          ...audio,
          type: "IMAGE",
          content: "[IMAGE]",
          extractedText: "Deux modèles de site.",
        };
        const prepared = prepareSummaryHistory([image, audio]);
        assert.equal(prepared.partial, false);
        assert.match(prepared.history[0].content, /Je veux un devis/);
        assert.match(prepared.history[1].content, /Deux modèles/);
        const failed = prepareSummaryHistory([
          { ...audio, extractionStatus: "FAILED" },
        ]);
        assert.equal(failed.partial, true);
        assert.doesNotMatch(failed.history[0].content, /Je veux/);
        globalThis.fetch = async (url, init) => {
          assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
          const body = JSON.parse(String(init?.body));
          assert.match(body.messages[1].content, /Je veux un devis/);
          return Response.json({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    replies: [
                      "Pour quelle activité ?",
                      "Quel est votre délai ?",
                    ],
                  }),
                },
              },
            ],
          });
        };
        assert.equal(
          (
            await generateWritingAssistance({
              mode: "suggest",
              history: prepared.history,
              instructions: "Vendre des sites",
            })
          ).length,
          2,
        );
        globalThis.fetch = async (url, init) => {
          assert.equal(url, "https://openrouter.ai/api/alpha/decisions");
          const body = JSON.parse(String(init?.body));
          assert.match(body.state.history[0].content, /Je veux un devis/);
          assert.match(body.state.history[1].content, /Deux modèles/);
          return Response.json({
            answers: {
              classification: {
                type: "choice",
                choice: "interesting",
                probabilities: { interesting: 1, follow_up: 0, none: 0 },
                confidence: 1,
              },
            },
          });
        };
        assert.equal(
          await assessProspect("Vendre des sites", [audio, image]),
          "interesting",
        );
      },
    );
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.OPENROUTER_MODEL;
    else process.env.OPENROUTER_MODEL = oldModel;
  }
});
