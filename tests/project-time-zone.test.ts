import { test } from "node:test";
import assert from "node:assert/strict";
import { SettingsError } from "../lib/project-settings";
import { setProjectTimeZone } from "../lib/project-time-zone";
import { DEFAULT_PROJECT_TIME_ZONE, projectTimeZone, timeZoneGroups } from "../lib/time-zones";
import { utcOffsetLabel } from "../lib/user-time-zone";
import { addMember, createProject, createUser, withTestDatabase } from "./helpers/database";

test("time zones are offered with their UTC offset", () => {
  const winter = new Date(Date.UTC(2026, 0, 15, 12));
  assert.equal(utcOffsetLabel("Africa/Libreville", winter), "UTC+1");
  assert.equal(utcOffsetLabel("Africa/Lome", winter), "UTC+0");
  assert.equal(utcOffsetLabel("America/St_Johns", winter), "UTC−3:30");

  const groups = timeZoneGroups(winter);
  const africa = groups.find((group) => group.label === "Afrique");
  assert.ok(
    africa?.options.some(
      (option) => option.value === "Africa/Lome" && option.label === "Lome" && option.offset === "UTC+0",
    ),
  );
  assert.equal(groups.at(-1)?.label, "Temps universel");
  assert.equal(projectTimeZone("Mars/Olympus"), DEFAULT_PROJECT_TIME_ZONE);
  assert.equal(projectTimeZone("Africa/Lome"), "Africa/Lome");
});

test("project time zone", { timeout: 120000 }, async (t) => {
  await withTestDatabase(async (prisma) => {
    const project = await createProject(prisma);
    const owner = await createUser(prisma, "Owner");
    const agent = await createUser(prisma, "Agent");
    await addMember(prisma, project.id, owner.id, "OWNER");
    await addMember(prisma, project.id, agent.id, "AGENT");
    // Projects created before the setting keep the zone used until now.
    assert.equal(project.timeZone, DEFAULT_PROJECT_TIME_ZONE);
    const zone = async () =>
      (await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).timeZone;

    await t.test("only admins change it, and only to a known zone", async () => {
      await assert.rejects(
        setProjectTimeZone(prisma, { projectId: project.id, userId: agent.id, timeZone: "Africa/Lome" }),
        SettingsError,
      );
      await assert.rejects(
        setProjectTimeZone(prisma, { projectId: project.id, userId: owner.id, timeZone: "Mars/Olympus" }),
        /Fuseau horaire inconnu/,
      );
      assert.equal(await zone(), DEFAULT_PROJECT_TIME_ZONE);
    });

    await t.test("saves, audits and wakes broadcasts waiting for the old hours", async () => {
      const later = new Date(Date.now() + 10 * 3_600_000);
      const broadcast = (status: "SCHEDULED" | "SENDING", pauseReason: string | null) =>
        prisma.broadcast.create({
          data: {
            projectId: project.id,
            createdById: owner.id,
            requestId: crypto.randomUUID(),
            name: "Promo",
            content: "Bonjour {prénom}",
            audience: {},
            status,
            pauseReason,
            scheduledAt: new Date(),
            nextSendAt: later,
            recipientCount: 1,
          },
        });
      const waiting = await broadcast("SENDING", "OUTSIDE_WINDOW");
      const scheduled = await broadcast("SCHEDULED", null);

      const saved = await setProjectTimeZone(prisma, {
        projectId: project.id,
        userId: owner.id,
        timeZone: "Africa/Lome",
      });
      assert.equal(saved, "Africa/Lome");
      assert.equal(await zone(), "Africa/Lome");

      const woken = await prisma.broadcast.findUniqueOrThrow({ where: { id: waiting.id } });
      assert.ok(woken.nextSendAt.getTime() <= Date.now());
      // A broadcast scheduled by the user keeps its date.
      const kept = await prisma.broadcast.findUniqueOrThrow({ where: { id: scheduled.id } });
      assert.equal(kept.nextSendAt.getTime(), later.getTime());

      const audits = () =>
        prisma.settingsAudit.count({ where: { projectId: project.id, action: "timezone.updated" } });
      assert.equal(await audits(), 1);
      // Saving the same zone again changes nothing.
      await setProjectTimeZone(prisma, { projectId: project.id, userId: owner.id, timeZone: "Africa/Lome" });
      assert.equal(await audits(), 1);
    });
  });
});
