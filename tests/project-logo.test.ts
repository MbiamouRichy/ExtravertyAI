import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isProjectLogoKey,
  projectLogoKey,
  projectLogoUrl,
  sniffLogoType,
} from "../lib/project-logo";

test("project logos are checked by content and bound to their project", () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
  const webp = new TextEncoder().encode("RIFF0000WEBPVP8 ");
  assert.equal(sniffLogoType(png), "image/png");
  assert.equal(sniffLogoType(jpeg), "image/jpeg");
  assert.equal(sniffLogoType(webp), "image/webp");
  // Un SVG ou un HTML renommé en image est refusé.
  assert.equal(sniffLogoType(new TextEncoder().encode("<svg onload=alert(1)>")), null);

  const id = "1b4e28ba-2fa1-11d2-883f-0016d3cca427";
  const key = projectLogoKey("projet-a", id, "image/png");
  assert.equal(isProjectLogoKey("projet-a", key), true);
  // Une clé d’un autre projet ou détournée n’est jamais servie.
  assert.equal(isProjectLogoKey("projet-b", key), false);
  assert.equal(isProjectLogoKey("projet-a", "profiles/../secret.png"), false);
  assert.equal(projectLogoUrl("projet-a", key), "/api/projects/projet-a/logo?v=1b4e28ba");
  assert.equal(projectLogoUrl("projet-a", null), null);
});
