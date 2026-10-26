import { test } from "node:test";
import assert from "node:assert/strict";
import { visibleMessageSources } from "../lib/message-sources";
test("known sources are shown directly without zeros or double counting", () => {
  const rows = visibleMessageSources(
    [
      { source: "android", count: 0 },
      { source: "ios", count: 0 },
      { source: "ai", count: 6 },
      { source: "unknown", count: 11 },
    ],
    [
      { source: "whatsapp", count: 8 },
      { source: "web_dashboard", count: 3 },
    ],
  );
  assert.deepEqual(
    rows.map((row) => [row.source, row.count]),
    [
      ["whatsapp", 8],
      ["ai", 6],
      ["web_dashboard", 3],
    ],
  );
  assert.equal(
    rows.reduce((sum, row) => sum + row.count, 0),
    17,
  );
});
test("a truly unspecified source stays visible and empty data stays empty", () => {
  assert.deepEqual(
    visibleMessageSources([{ source: "unknown", count: 0 }]),
    [],
  );
  assert.equal(
    visibleMessageSources([{ source: "unknown", count: 4 }])[0].label,
    "Origine non renseignée",
  );
});
