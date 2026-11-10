// De bout en bout avec un faux GlitchTip local : le SDK envoie bien les
// erreurs des workers, nettoyées, et un cycle en échec n’est signalé qu’une
// fois par période.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

test("une erreur de worker arrive nettoyée, une seule fois par période", async () => {
  const received: string[] = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      received.push(`${request.url}\n${body}`);
      response.writeHead(200).end("{}");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const silenced = console.error;
  console.error = () => {};
  try {
    process.env.ERROR_TRACKING_DSN = `http://cle@localhost:${port}/7`;
    process.env.ERROR_TRACKING_ENVIRONMENT = "test";
    const monitoring = await import("../workers/monitoring");
    monitoring.initWorkerMonitoring("test-worker");

    const failure = new Error("Evolution refuse https://evo.example.com/x?secret=s3cr3t pour +24106123456");
    monitoring.reportWorkerError("[test] Cycle interrompu.", failure);
    monitoring.reportWorkerError("[test] Cycle interrompu.", failure);
    await monitoring.flushWorkerMonitoring();

    const events = received.filter((item) => item.includes('"type":"event"'));
    assert.equal(events.length, 1, "un seul signalement pour deux échecs rapprochés");
    assert.match(events[0], /^\/api\/7\/envelope\//);
    assert.match(events[0], /"worker":"test-worker"/);
    assert.match(events[0], /"environment":"test"/);
    assert.ok(!events[0].includes("s3cr3t"), "secret transmis");
    assert.ok(!events[0].includes("24106123456"), "numéro transmis");
  } finally {
    console.error = silenced;
    server.close();
  }
});
