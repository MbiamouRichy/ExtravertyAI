import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PipelineError,
  currencyDigits,
  formatDealValue,
  movePipelineStage,
  parseDealValue,
  pipelineBoard,
  promoteInterestingProspect,
  setDealValue,
  wonValue,
} from "../lib/pipeline";
import { PlanFeatureError } from "../lib/plan-features";
import {
  addMember,
  createProject,
  createUser,
  ingestText,
  withTestDatabase,
} from "./helpers/database";

test("deal amounts follow the currency's minor unit", () => {
  assert.equal(currencyDigits("XAF"), 0);
  assert.equal(currencyDigits("EUR"), 2);
  assert.equal(parseDealValue("150 000", "XAF"), 150000);
  assert.equal(parseDealValue("1 250,50", "EUR"), 125050);
  assert.equal(parseDealValue("1250.5", "EUR"), 125050);
  assert.equal(parseDealValue("   ", "XAF"), null);
  for (const bad of ["12,5", "abc", "-3", "1.2.3"]) {
    assert.throws(() => parseDealValue(bad, "XAF"), PipelineError, bad);
  }
  assert.throws(() => parseDealValue("3000000000", "XAF"), /trop élevé/);
  assert.match(formatDealValue(150000, "XAF"), /150\s000\sFCFA/);
});

test("lead pipeline", { timeout: 120000 }, async (t) => {
  await withTestDatabase(async (prisma) => {
    const owner = await createUser(prisma, "Clara Mba");
    const outsider = await createUser(prisma);

    await t.test("the pipeline is reserved to Pro and Business plans", async () => {
      const starter = await createProject(prisma, { plan: "starter" });
      await addMember(prisma, starter.id, owner.id, "OWNER");
      const contact = await ingestText(prisma, starter.id, "Bonjour");
      await assert.rejects(
        movePipelineStage(prisma, {
          projectId: starter.id,
          contactId: contact.id,
          userId: owner.id,
          stage: "WON",
        }),
        PlanFeatureError,
      );
    });

    const project = await createProject(prisma, { plan: "pro" });
    await addMember(prisma, project.id, owner.id, "OWNER");
    const contact = await ingestText(prisma, project.id, "Vous avez le modèle en 42 ?");
    const actor = { projectId: project.id, contactId: contact.id, userId: owner.id };

    await t.test("Instinct only promotes untouched new prospects", async () => {
      assert.equal(
        await prisma.$transaction((tx) => promoteInterestingProspect(tx, project.id, contact.id)),
        true,
      );
      let saved = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
      assert.equal(saved.pipelineStage, "INTERESTED");
      assert.equal(saved.stageChangedById, null);

      // A member moves it back by hand: Instinct must not override that choice.
      await movePipelineStage(prisma, { ...actor, stage: "NEW" });
      assert.equal(
        await prisma.$transaction((tx) => promoteInterestingProspect(tx, project.id, contact.id)),
        false,
      );
      saved = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
      assert.equal(saved.pipelineStage, "NEW");
      assert.equal(saved.stageChangedById, owner.id);
    });

    await t.test("moves are member-only, logged once and idempotent", async () => {
      await assert.rejects(
        movePipelineStage(prisma, { ...actor, userId: outsider.id, stage: "WON" }),
        /indisponible/,
      );
      const first = await movePipelineStage(prisma, { ...actor, stage: "QUOTE_SENT" });
      assert.equal(first.changed, true);
      const again = await movePipelineStage(prisma, { ...actor, stage: "QUOTE_SENT" });
      assert.equal(again.changed, false);
      const events = await prisma.contactEvent.findMany({
        where: { contactId: contact.id, type: "STAGE_CHANGED", detail: "Devis envoyé" },
      });
      assert.equal(events.length, 1);
    });

    await t.test("deal values are validated and summed per stage", async () => {
      await assert.rejects(setDealValue(prisma, { ...actor, value: -1 }), PipelineError);
      await assert.rejects(setDealValue(prisma, { ...actor, value: 2_000_000_001 }), PipelineError);
      await setDealValue(prisma, { ...actor, value: 250000 });

      const second = await ingestText(prisma, project.id, "Je prends", "24199999999@s.whatsapp.net");
      await setDealValue(prisma, { ...actor, contactId: second.id, value: 100000 });
      await movePipelineStage(prisma, { ...actor, contactId: second.id, stage: "WON" });

      const board = await pipelineBoard(prisma, project.id, owner.id);
      assert.ok(board);
      assert.equal(board.currency, "XAF");
      const quote = board.columns.find((column) => column.id === "QUOTE_SENT");
      const won = board.columns.find((column) => column.id === "WON");
      assert.equal(quote?.count, 1);
      assert.equal(quote?.total, 250000);
      assert.equal(won?.cards[0]?.id, second.id);
      assert.deepEqual(await wonValue(prisma, project.id, new Date(Date.now() - 86400000)), {
        total: 100000,
        deals: 1,
      });
      assert.equal(await pipelineBoard(prisma, project.id, outsider.id), null);
    });
  });
});
