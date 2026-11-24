import { test } from "node:test";
import assert from "node:assert/strict";
import {
  androidChromeIntentUrl,
  detectInAppBrowser,
  inAppBrowserLabel,
} from "../lib/in-app-browser";
import {
  claimChunkReload,
  CHUNK_RELOAD_WINDOW_MS,
  isChunkLoadError,
} from "../lib/chunk-reload";
import {
  clearPendingCode,
  PENDING_CODE_KEY,
  PENDING_CODE_TTL_MS,
  readPendingCode,
  resendDelayLeft,
  savePendingCode,
} from "../lib/pending-code";

const UA = {
  facebookAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-A145F Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.107 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/489.0.0.53.81;]",
  facebookIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22B83 [FBAN/FBIOS;FBAV/489.0.0.38.109;FBBV/650000000;FBDV/iPhone15,3;FBMD/iPhone;FBSN/iOS;FBSV/18.1;FBSS/3;FBID/phone;FBLC/fr_FR;FBOP/5;FBRV/0]",
  instagramAndroid:
    "Mozilla/5.0 (Linux; Android 13; Infinix X6528 Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.102 Mobile Safari/537.36 Instagram 356.0.0.41.101 Android (33/13; 480dpi; 1080x2400; INFINIX; Infinix X6528; Infinix-X6528; mt6789; fr_FR; 652700000)",
  instagramIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 356.0.0.24.91 (iPhone14,7; iOS 17_6; fr_FR; fr; scale=3.00; 1170x2532; 652000000)",
  messengerAndroid:
    "Mozilla/5.0 (Linux; Android 12; TECNO KG5 Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 [FB_IAB/MESSENGER;FBAV/480.0.0.42.109;]",
  messengerIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/470.0.0.41.107;FBBV/600000000;FBDV/iPhone13,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBCR/;FBID/phone;FBLC/fr_FR;FBOP/0]",
  tiktokAndroid:
    "Mozilla/5.0 (Linux; Android 13; SM-A135F Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.146 Mobile Safari/537.36 trill_370103 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/37.1.3 ByteLocale/fr ByteFullLocale/fr Region/GA BytedanceWebview/d8a21c6",
  linkedinIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.29.6",
  genericAndroidWebView:
    "Mozilla/5.0 (Linux; Android 11; itel A662L Build/RP1A.201005.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.193 Mobile Safari/537.36",
  whatsappPreviewBot: "WhatsApp/2.24.20.80 A",
  whatsappAndroidWebView:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/AP2A.240805.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.58 Mobile Safari/537.36 WhatsApp/2.24.22.79",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  safariIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  chromeIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1",
  samsungInternet:
    "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
  firefoxDesktop: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
  chromeDesktop:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
};

test("Facebook, Instagram and Messenger in-app browsers are detected on Android and iOS", () => {
  assert.deepEqual(detectInAppBrowser(UA.facebookAndroid), { app: "facebook", os: "android" });
  assert.deepEqual(detectInAppBrowser(UA.facebookIos), { app: "facebook", os: "ios" });
  assert.deepEqual(detectInAppBrowser(UA.instagramAndroid), { app: "instagram", os: "android" });
  assert.deepEqual(detectInAppBrowser(UA.instagramIos), { app: "instagram", os: "ios" });
  assert.deepEqual(detectInAppBrowser(UA.messengerAndroid), { app: "messenger", os: "android" });
  assert.deepEqual(detectInAppBrowser(UA.messengerIos), { app: "messenger", os: "ios" });
});

test("TikTok, LinkedIn and unknown Android web views are detected too", () => {
  assert.deepEqual(detectInAppBrowser(UA.tiktokAndroid), { app: "tiktok", os: "android" });
  assert.deepEqual(detectInAppBrowser(UA.linkedinIos), { app: "linkedin", os: "ios" });
  assert.deepEqual(detectInAppBrowser(UA.genericAndroidWebView), { app: "webview", os: "android" });
});

test("WhatsApp counts only inside a real embedded web view, never for its link preview bot", () => {
  assert.equal(detectInAppBrowser(UA.whatsappPreviewBot), null);
  assert.deepEqual(detectInAppBrowser(UA.whatsappAndroidWebView), { app: "whatsapp", os: "android" });
});

test("regular browsers keep the Google button", () => {
  for (const ua of [
    UA.chromeAndroid,
    UA.safariIos,
    UA.chromeIos,
    UA.samsungInternet,
    UA.firefoxDesktop,
    UA.chromeDesktop,
  ]) {
    assert.equal(detectInAppBrowser(ua), null, ua);
  }
});

test("a missing, empty or oversized user agent is treated as a regular browser", () => {
  assert.equal(detectInAppBrowser(null), null);
  assert.equal(detectInAppBrowser(undefined), null);
  assert.equal(detectInAppBrowser("   "), null);
  assert.equal(detectInAppBrowser(`${UA.facebookAndroid}${" ".repeat(2000)}x`), null);
});

test("each named app has a display label, the generic web view has none", () => {
  assert.equal(inAppBrowserLabel("facebook"), "Facebook");
  assert.equal(inAppBrowserLabel("instagram"), "Instagram");
  assert.equal(inAppBrowserLabel("webview"), null);
});

test("the Chrome intent keeps the path and query, drops the fragment and refuses other schemes", () => {
  assert.equal(
    androidChromeIntentUrl(
      "https://www.extravertyai.com/sign-up?utm_campaign=video-awa&callbackUrl=%2Fprojects#top",
    ),
    "intent://www.extravertyai.com/sign-up?utm_campaign=video-awa&callbackUrl=%2Fprojects#Intent;scheme=https;package=com.android.chrome;end",
  );
  assert.equal(
    androidChromeIntentUrl("http://localhost:3000/sign-in"),
    "intent://localhost:3000/sign-in#Intent;scheme=http;package=com.android.chrome;end",
  );
  assert.equal(androidChromeIntentUrl("javascript:alert(1)"), null);
  assert.equal(androidChromeIntentUrl("https://user:pass@example.com/"), null);
  assert.equal(androidChromeIntentUrl("not a url"), null);
});

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

test("a chunk load error is recognised from webpack, Chrome, Firefox and Safari wordings", () => {
  const chunk = new Error("Loading chunk 4821 failed.\n(error: https://x/_next/static/chunks/4821.js)");
  chunk.name = "ChunkLoadError";
  assert.ok(isChunkLoadError(chunk));
  assert.ok(isChunkLoadError(new Error("Loading CSS chunk app-layout failed")));
  assert.ok(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: https://x/a.js")));
  assert.ok(isChunkLoadError(new TypeError("error loading dynamically imported module")));
  assert.ok(isChunkLoadError(new TypeError("Importing a module script failed.")));
  assert.equal(isChunkLoadError(new Error("Network request failed")), false);
  assert.equal(isChunkLoadError("ChunkLoadError"), false);
  assert.equal(isChunkLoadError(null), false);
});

test("after a chunk load error the page reloads once, then not again within the window", () => {
  const storage = memoryStorage();
  const now = 1_800_000_000_000;
  assert.equal(claimChunkReload(storage, now), true);
  assert.equal(claimChunkReload(storage, now + 1000), false);
  assert.equal(claimChunkReload(storage, now + CHUNK_RELOAD_WINDOW_MS - 1), false);
  assert.equal(claimChunkReload(storage, now + CHUNK_RELOAD_WINDOW_MS), true);
});

test("without usable storage the page never reloads, so it cannot loop", () => {
  assert.equal(claimChunkReload(null), false);
  const throwing = {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("denied");
    },
  };
  assert.equal(claimChunkReload(throwing), false);
  const ignoring = { getItem: () => null, setItem: () => {} };
  assert.equal(claimChunkReload(ignoring), false);
});

test("a pending code survives a reload for its own flow, then expires with the code", () => {
  const storage = memoryStorage();
  const sentAt = 1_800_000_000_000;
  savePendingCode(storage, {
    flow: "sign-up",
    purpose: "sign-up",
    email: "Awa@Example.com ",
    name: "Awa",
    sentAt,
  });
  assert.deepEqual(readPendingCode(storage, "sign-up", sentAt + 60_000), {
    flow: "sign-up",
    purpose: "sign-up",
    email: "awa@example.com",
    name: "Awa",
    sentAt,
  });
  // The sign-in page does not pick up a sign-up, and leaves it in place.
  assert.equal(readPendingCode(storage, "sign-in", sentAt + 60_000), null);
  assert.ok(storage.map.has(PENDING_CODE_KEY));
  assert.equal(readPendingCode(storage, "sign-up", sentAt + PENDING_CODE_TTL_MS), null);
  assert.equal(storage.map.has(PENDING_CODE_KEY), false);
});

test("a pending code never stores the code or a password, and bad drafts are discarded", () => {
  const storage = memoryStorage();
  const sentAt = 1_800_000_000_000;
  savePendingCode(storage, {
    flow: "sign-in",
    purpose: "sign-in",
    email: "awa@example.com",
    sentAt,
    // Extra fields are stripped by the schema.
    ...({ otp: "123456", password: "secret-password" } as object),
  });
  const stored = storage.map.get(PENDING_CODE_KEY) ?? "";
  assert.ok(!stored.includes("123456"));
  assert.ok(!stored.includes("secret-password"));

  storage.map.set(PENDING_CODE_KEY, "{not json");
  assert.equal(readPendingCode(storage, "sign-in", sentAt), null);
  assert.equal(storage.map.has(PENDING_CODE_KEY), false);

  storage.map.set(PENDING_CODE_KEY, JSON.stringify({ flow: "sign-in", email: "x" }));
  assert.equal(readPendingCode(storage, "sign-in", sentAt), null);
  assert.equal(storage.map.has(PENDING_CODE_KEY), false);

  // Dated in the future: clock changed or forged, never trusted.
  savePendingCode(storage, { flow: "sign-in", purpose: "sign-in", email: "a@b.co", sentAt });
  assert.equal(readPendingCode(storage, "sign-in", sentAt - 1), null);

  savePendingCode(storage, { flow: "sign-in", purpose: "sign-in", email: "a@b.co", sentAt });
  clearPendingCode(storage);
  assert.equal(readPendingCode(storage, "sign-in", sentAt), null);
  assert.equal(readPendingCode(null, "sign-in", sentAt), null);
});

test("the resend delay resumes where it was after a reload", () => {
  const sentAt = 1_800_000_000_000;
  assert.equal(resendDelayLeft(sentAt, 60, sentAt), 60);
  assert.equal(resendDelayLeft(sentAt, 60, sentAt + 25_400), 35);
  assert.equal(resendDelayLeft(sentAt, 60, sentAt + 90_000), 0);
  assert.equal(resendDelayLeft(sentAt, 60, sentAt - 5_000), 60);
});
