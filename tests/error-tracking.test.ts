import { test } from "node:test";
import assert from "node:assert/strict";
import { scrubEvent, scrubText } from "../lib/error-tracking/scrub";
import { envelopeTarget, parseDsn } from "../lib/error-tracking/tunnel";
import { errorTrackingEnvironment, errorTrackingRelease } from "../lib/error-tracking/options";

test("les secrets, e-mails et numéros ne quittent jamais l’app", () => {
  const text = [
    "POST https://app.example.com/api/webhooks/evolution?secret=abc123&x=1 failed",
    "Authorization: Bearer sk_live_0123456789abcdef",
    "postgresql://extraverty_prod:MotDePasse!@db.example.com:5432/extravertyai_production",
    "client jean.dupont@example.com, numéro +24106123456, jid 24177889900@s.whatsapp.net",
  ].join("\n");
  const clean = scrubText(text);
  for (const leaked of ["abc123", "sk_live_0123456789abcdef", "MotDePasse", "jean.dupont", "24106123456", "24177889900"])
    assert.ok(!clean.includes(leaked), `fuite : ${leaked}`);
  assert.match(clean, /\?secret=\[masqué\]&x=1/);
  assert.match(clean, /postgresql:\/\/\[masqué\]@db\.example\.com/);
});

test("le contexte technique reste lisible", () => {
  const stack = "at runAiJob (lib/ai-jobs.ts:412:17) le 2026-11-10T05:04:34.873Z, projet cmw9smze900005c0nnfgx4t38";
  assert.equal(scrubText(stack), stack);
});

test("un événement perd utilisateur, cookies, corps et en-têtes sensibles", () => {
  const event = scrubEvent({
    message: "Échec pour +24106123456",
    user: { email: "a@b.co", ip_address: "1.2.3.4" },
    request: {
      url: "https://app.example.com/projects/x?token=t0k3n",
      cookies: { session: "s" },
      data: { phone: "+24106123456" },
      headers: { Cookie: "session=s", Authorization: "Bearer abcdefghij", "User-Agent": "Android" },
    },
    exception: { values: [{ value: "contact ok@example.org", stacktrace: { frames: [{ vars: { phone: "24106123456" } }] } }] },
  });
  assert.equal(event.user, undefined);
  assert.equal(event.request?.cookies, undefined);
  assert.equal(event.request?.data, undefined);
  assert.deepEqual(event.request?.headers, { "User-Agent": "Android" });
  assert.ok(!JSON.stringify(event).match(/24106123456|ok@example\.org|t0k3n|a@b\.co/));
});

test("le relais ne transmet que les enveloppes du projet configuré", () => {
  const configured = parseDsn("https://cle@errors.example.com/3")!;
  assert.equal(configured.envelopeUrl, "https://errors.example.com/api/3/envelope/");
  const envelope = (dsn: string) =>
    new TextEncoder().encode(`${JSON.stringify({ dsn, event_id: "e" })}\n{"type":"event"}\n{}`);
  assert.equal(envelopeTarget(envelope("https://cle@errors.example.com/3"), configured), configured.envelopeUrl);
  // Autre projet, autre clé, autre hôte ou en-tête illisible : refusé.
  assert.equal(envelopeTarget(envelope("https://cle@errors.example.com/4"), configured), null);
  assert.equal(envelopeTarget(envelope("https://autre@errors.example.com/3"), configured), null);
  assert.equal(envelopeTarget(envelope("https://cle@attacker.example/3"), configured), null);
  assert.equal(envelopeTarget(new TextEncoder().encode("pas du json\n{}"), configured), null);
});

test("un DSN invalide ou en clair désactive le suivi", () => {
  assert.equal(parseDsn(undefined), null);
  assert.equal(parseDsn("pas une url"), null);
  assert.equal(parseDsn("http://cle@errors.example.com/3"), null);
  assert.equal(parseDsn("https://errors.example.com/3"), null);
  assert.equal(parseDsn("https://cle@errors.example.com/abc"), null);
});

test("environnement et version viennent de Vercel ou du serveur", () => {
  assert.equal(errorTrackingEnvironment({ VERCEL_ENV: "preview" }), "preview");
  assert.equal(errorTrackingEnvironment({ ERROR_TRACKING_ENVIRONMENT: "production-workers", VERCEL_ENV: "x" }), "production-workers");
  assert.equal(errorTrackingEnvironment({ NODE_ENV: "development" }), "development");
  assert.equal(errorTrackingRelease({ VERCEL_GIT_COMMIT_SHA: "5aa5a08f00112233445566778899aabbccddeeff" }), "5aa5a08f0011");
  assert.equal(errorTrackingRelease({ GIT_COMMIT_SHA: "pas-un-sha" }), undefined);
});
