import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  campaignFrom,
  googleSignUpReturn,
  readGoogleSignUp,
  rememberArrivalCampaign,
  visitCampaign,
} from "../lib/auth-analytics";

describe("campaignFrom", () => {
  it("garde les seuls paramètres utm_* lisibles", () => {
    assert.deepEqual(
      campaignFrom("?utm_source=facebook&utm_campaign=video-awa&fbclid=abc&email=a@b.c"),
      { utm_source: "facebook", utm_campaign: "video-awa" },
    );
  });

  it("écarte les valeurs vides, trop longues ou inattendues", () => {
    assert.deepEqual(
      campaignFrom(
        `?utm_source=%20&utm_medium=${"a".repeat(101)}&utm_campaign=<script>&utm_content=Vidéo 16:9`,
      ),
      { utm_content: "Vidéo 16:9" },
    );
  });
});

describe("visitCampaign", () => {
  it("préfère la campagne de la page, sinon celle d'arrivée", () => {
    rememberArrivalCampaign("?utm_campaign=lancement-gabon");
    assert.deepEqual(visitCampaign("?utm_campaign=video-awa"), { utm_campaign: "video-awa" });
    assert.deepEqual(visitCampaign(""), { utm_campaign: "lancement-gabon" });
    rememberArrivalCampaign("");
    assert.deepEqual(visitCampaign(""), {});
  });
});

describe("googleSignUpReturn", () => {
  it("ajoute le marqueur et la campagne à la destination", () => {
    assert.equal(
      googleSignUpReturn("/projects", { utm_source: "facebook", utm_campaign: "video-awa" }),
      "/projects?inscription=google&utm_source=facebook&utm_campaign=video-awa",
    );
  });

  it("garde les paramètres de la destination", () => {
    assert.equal(
      googleSignUpReturn("/projects/new?plan=pro", {}),
      "/projects/new?plan=pro&inscription=google",
    );
  });

  it("laisse intacte une adresse externe, sans marqueur", () => {
    assert.equal(googleSignUpReturn("//evil.example/x", {}), "//evil.example/x");
    assert.equal(googleSignUpReturn("https://evil.example/x", {}), "https://evil.example/x");
  });
});

describe("readGoogleSignUp", () => {
  it("ignore une adresse sans marqueur", () => {
    assert.equal(readGoogleSignUp("https://extravertyai.com/projects?utm_campaign=video-awa"), null);
    assert.equal(readGoogleSignUp("https://extravertyai.com/projects?inscription=autre"), null);
  });

  it("lit la campagne et nettoie l'adresse", () => {
    assert.deepEqual(
      readGoogleSignUp(
        "https://extravertyai.com/projects/new?plan=pro&inscription=google&utm_campaign=video-awa#offres",
      ),
      { campaign: { utm_campaign: "video-awa" }, cleanUrl: "/projects/new?plan=pro#offres" },
    );
  });

  it("relit ce que googleSignUpReturn produit", () => {
    const back = googleSignUpReturn("/projects", { utm_campaign: "video-awa" });
    assert.deepEqual(readGoogleSignUp(`https://extravertyai.com${back}`), {
      campaign: { utm_campaign: "video-awa" },
      cleanUrl: "/projects",
    });
  });
});
