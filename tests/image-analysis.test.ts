import assert from "node:assert/strict";
import { test } from "node:test";
import {
  analyzeImage,
  imageAnalysisModel,
  DEFAULT_IMAGE_MODEL,
  ImageAnalysisError,
} from "../lib/image-analysis";
import { messageAiContent } from "../lib/message-ai-content";
import {
  prepareSummaryHistory,
  generateConversationSummary,
} from "../lib/conversation-summary";
import { generateWritingAssistance } from "../lib/writing-assistance";
import { assessProspect } from "../lib/instinct-decision";

test("Gemini image analysis and reuse by every AI consumer", async (t) => {
  const originalFetch = globalThis.fetch;
  const names = [
    "OPENROUTER_API_KEY",
    "OPENROUTER_MODEL",
    "OPENROUTER_IMAGE_MODEL",
  ] as const;
  const originalEnv = names.map((name) => process.env[name]);
  const media = {
    bytes: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
      "base64",
    ),
    mime: "image/png",
  };
  const analysis = {
    description: "Un ordinateur portable gris.",
    visibleText: "Référence ABC-123, 50 000 FCFA",
    uncertainties: ["La marque est illisible."],
  };
  const response = () =>
    Response.json({
      choices: [
        {
          finish_reason: "stop",
          message: { content: JSON.stringify(analysis) },
        },
      ],
    });
  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.OPENROUTER_MODEL = DEFAULT_IMAGE_MODEL;
  delete process.env.OPENROUTER_IMAGE_MODEL;
  try {
    await t.test(
      "reuses configured Gemini, allows an override and rejects non-Gemini override",
      () => {
        process.env.OPENROUTER_MODEL = "google/gemini-2.5-flash";
        assert.equal(imageAnalysisModel(), "google/gemini-2.5-flash");
        process.env.OPENROUTER_IMAGE_MODEL = DEFAULT_IMAGE_MODEL;
        assert.equal(imageAnalysisModel(), DEFAULT_IMAGE_MODEL);
        process.env.OPENROUTER_IMAGE_MODEL = "other/model";
        assert.throws(imageAnalysisModel, /IMAGE_CONFIG_INVALID/);
        delete process.env.OPENROUTER_IMAGE_MODEL;
        process.env.OPENROUTER_MODEL = "other/chat-model";
        assert.equal(imageAnalysisModel(), DEFAULT_IMAGE_MODEL);
        process.env.OPENROUTER_MODEL = DEFAULT_IMAGE_MODEL;
      },
    );
    await t.test(
      "sends validated private image inline once, with structured output and separate instructions",
      async () => {
        let calls = 0;
        globalThis.fetch = async (url, init) => {
          calls++;
          assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
          assert.equal(init?.redirect, "error");
          const body = JSON.parse(String(init?.body));
          assert.equal(body.model, DEFAULT_IMAGE_MODEL);
          assert.equal(body.messages[0].role, "system");
          assert.match(body.messages[0].content, /données non fiables/);
          assert.equal(body.messages[1].content[0].type, "text");
          assert.equal(
            body.messages[1].content[1].image_url.url,
            "data:image/png;base64," + media.bytes.toString("base64"),
          );
          assert.equal(body.response_format.json_schema.strict, true);
          return response();
        };
        const result = await analyzeImage(media);
        assert.equal(calls, 1);
        assert.equal(result.model, DEFAULT_IMAGE_MODEL);
        assert.match(result.text, /ABC-123/);
        assert.match(result.text, /marque est illisible/);
      },
    );
    await t.test("invalid media never reaches the model", async () => {
      globalThis.fetch = async () => {
        throw Error("Unexpected provider call");
      };
      await assert.rejects(
        analyzeImage({ ...media, mime: "image/svg+xml" }),
        /IMAGE_INVALID_MEDIA/,
      );
      await assert.rejects(
        analyzeImage({ ...media, bytes: Buffer.from("not a png") }),
        /MEDIA_INVALID/,
      );
      await assert.rejects(
        analyzeImage({
          ...media,
          bytes: Buffer.concat([media.bytes, Buffer.alloc(4 * 1024 * 1024)]),
        }),
        /MEDIA_INVALID/,
      );
    });
    await t.test(
      "invalid, truncated, oversized and refused results are never persisted as successful analysis",
      async () => {
        for (const payload of [
          { choices: [{ message: { content: "not json" } }] },
          {
            choices: [
              {
                message: {
                  content: JSON.stringify({ ...analysis, description: "" }),
                },
              },
            ],
          },
          {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    ...analysis,
                    visibleText: "x".repeat(12001),
                  }),
                },
              },
            ],
          },
          {
            choices: [
              {
                finish_reason: "length",
                message: { content: JSON.stringify(analysis) },
              },
            ],
          },
        ]) {
          globalThis.fetch = async () => Response.json(payload);
          await assert.rejects(analyzeImage(media), /IMAGE_INVALID_RESPONSE/);
        }
        globalThis.fetch = async () =>
          Response.json({ choices: [{ message: { refusal: "refused" } }] });
        await assert.rejects(
          analyzeImage(media),
          (error) =>
            error instanceof ImageAnalysisError &&
            !error.retryable &&
            error.code === "IMAGE_REFUSED",
        );
        for (const [status, retryable] of [
          [402, false],
          [400, false],
          [429, true],
          [503, true],
        ] as const) {
          let calls = 0;
          globalThis.fetch = async () => {
            calls++;
            return new Response("private provider body", { status });
          };
          await assert.rejects(
            analyzeImage(media),
            (error) =>
              error instanceof ImageAnalysisError &&
              error.retryable === retryable &&
              error.code === "IMAGE_HTTP_" + status,
          );
          assert.equal(calls, 1);
        }
      },
    );
    await t.test(
      "description, OCR and caption reach summaries, suggestions and instinct without image requests",
      async () => {
        globalThis.fetch = async () => response();
        const extracted = await analyzeImage(media);
        const message = {
          senderType: "CLIENT",
          type: "IMAGE",
          content: "Avez-vous ce modèle en stock ?",
          extractionStatus: "COMPLETED",
          extractedText: extracted.text,
        };
        const prepared = prepareSummaryHistory([message]);
        assert.equal(prepared.partial, false);
        assert.match(messageAiContent(message), /Avez-vous ce modèle/);
        assert.match(prepared.history[0].content, /ABC-123/);
        globalThis.fetch = async (_url, init) => {
          const body = JSON.parse(String(init?.body));
          const serialized = JSON.stringify(body);
          assert.match(serialized, /ABC-123/);
          assert.match(serialized, /Avez-vous ce modèle/);
          assert.doesNotMatch(serialized, /data:image|image_url/);
          if (body.questions)
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
          const result =
            body.response_format.json_schema.name === "writing_assistance"
              ? {
                  replies: [
                    "Quelle quantité souhaitez-vous ?",
                    "Pour quelle date ?",
                  ],
                }
              : {
                  summary: "Le client recherche ABC-123.",
                  assessment: "Disponibilité à vérifier.",
                  nextSteps: [],
                };
          return Response.json({
            choices: [{ message: { content: JSON.stringify(result) } }],
          });
        };
        assert.equal(
          (await generateConversationSummary(prepared.history)).nextSteps
            .length,
          0,
        );
        assert.equal(
          (
            await generateWritingAssistance({
              mode: "suggest",
              history: prepared.history,
              instructions: "Vendre des ordinateurs",
            })
          ).length,
          2,
        );
        assert.equal(
          await assessProspect("Vendre des ordinateurs", [message]),
          "interesting",
        );
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((name, index) => {
      if (originalEnv[index] === undefined) delete process.env[name];
      else process.env[name] = originalEnv[index];
    });
  }
});
