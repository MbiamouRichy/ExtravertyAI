import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_PROFILE_IMAGE_SIZE,
  PROFILE_IMAGE_PATH,
  profileImageError,
  profileImageKey,
} from "../lib/profile-image";

test("profile images reject empty, oversized and unsupported files", () => {
  assert.ok(
    profileImageError(new File([], "empty.png", { type: "image/png" })),
  );
  assert.ok(
    profileImageError(
      new File([new Uint8Array(MAX_PROFILE_IMAGE_SIZE + 1)], "large.png", {
        type: "image/png",
      }),
    ),
  );
  assert.ok(
    profileImageError(
      new File(["<svg/>"], "image.svg", { type: "image/svg+xml" }),
    ),
  );
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    assert.equal(
      profileImageError(
        new File([new Uint8Array(MAX_PROFILE_IMAGE_SIZE)], "photo", { type }),
      ),
      null,
    );
  }
});

test("profile image routes only resolve generated object names", () => {
  const filename = "12345678-1234-1234-1234-123456789012.png";
  assert.equal(
    profileImageKey(`${PROFILE_IMAGE_PATH}${filename}`, "", ""),
    `profiles/${filename}`,
  );
  for (const filename of [
    "../secret",
    "nested/photo.png",
    "photo.svg",
    "photo.png?key=secret",
  ]) {
    assert.equal(
      profileImageKey(`${PROFILE_IMAGE_PATH}${filename}`, "", ""),
      null,
    );
  }
});

test("legacy cleanup never deletes external or unrelated bucket objects", () => {
  const endpoint = "http://storage.test/";
  assert.equal(
    profileImageKey(
      "http://storage.test/avatars/profiles/old.png",
      endpoint,
      "avatars",
    ),
    "profiles/old.png",
  );
  for (const image of [
    "https://other.test/avatars/profiles/old.png",
    "http://storage.test/other/profiles/old.png",
    "http://storage.test/avatars/private/secret.png",
    "http://storage.test/avatars/profiles/../secret.png",
  ])
    assert.equal(profileImageKey(image, endpoint, "avatars"), null);
});
