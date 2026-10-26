import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ProjectCheckoutSchema,
  ProjectCreationFormSchema,
  parseProjectPhone,
} from "../lib/project-creation-schema";

test("national numbers become international numbers for their selected country", () => {
  for (const [country, national, expected] of [
    ["FR", "06 12 34 56 78", "+33612345678"],
    ["KE", "0712 123456", "+254712123456"],
    ["IT", "02 3661 8300", "+390236618300"],
    ["US", "(213) 373-4253", "+12133734253"],
  ] as const) {
    const values = ProjectCreationFormSchema.parse({
      name: " Mon projet ",
      country,
      numero: national,
      plan: "starter",
    });
    assert.equal(values.name, "Mon projet");
    assert.equal(
      parseProjectPhone(values.numero, values.country)?.number,
      expected,
    );
  }
});

test("rejects country mismatch, invalid numbers, extensions and text extraction", () => {
  for (const numero of [
    "",
    "123",
    "+254712123456",
    "Appelez le 06 12 34 56 78",
    "06 12 34 56 78 ext 2",
    "0".repeat(41),
  ]) {
    assert.equal(
      ProjectCreationFormSchema.safeParse({
        name: "Projet",
        country: "FR",
        numero,
        plan: "starter",
      }).success,
      false,
      numero,
    );
  }
  assert.equal(
    ProjectCreationFormSchema.safeParse({
      name: "Projet",
      country: "XX",
      numero: "0612345678",
      plan: "starter",
    }).success,
    false,
  );
});

test("server schema revalidates and normalizes untrusted checkout data", () => {
  const data = {
    name: " Projet ",
    numero: "+33 6 12 34 56 78",
    plan: "starter",
  };
  assert.equal(ProjectCheckoutSchema.parse(data).numero, "+33612345678");
  assert.equal(
    ProjectCheckoutSchema.parse({ ...data, numero: "33612345678" }).numero,
    "+33612345678",
  );
  for (const bad of [
    { numero: "+33123" },
    { numero: null },
    { name: "ab" },
    { plan: "free" },
  ]) {
    assert.equal(
      ProjectCheckoutSchema.safeParse({ ...data, ...bad }).success,
      false,
    );
  }
});
