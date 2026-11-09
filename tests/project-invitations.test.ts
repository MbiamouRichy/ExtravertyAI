import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import {
  addMember,
  createProject,
  createUser,
  withTestDatabase,
} from "./helpers/database";
import {
  acceptInvitation,
  declineInvitation,
  hashInvitationToken,
} from "../lib/project-invitations";
import { teamSeats } from "../lib/plan-features";

test(
  "an invitation only opens a project to its recipient, once and with consent",
  { timeout: 600000 },
  async () => {
    await withTestDatabase(async (prisma) => {
      const project = await createProject(prisma);
      const owner = await createUser(prisma, "Propriétaire");
      const admin = await createUser(prisma, "Admin");
      const guest = await createUser(prisma, "Invité");
      const stranger = await createUser(prisma, "Inconnu");
      await addMember(prisma, project.id, owner.id, "OWNER");
      const adminRow = await addMember(prisma, project.id, admin.id, "ADMIN");

      const invite = async (
        inviterId = owner.id,
        role: "AGENT" | "VIEWER" = "AGENT",
        expiresAt = new Date(Date.now() + 60_000),
      ) => {
        const token = randomBytes(32).toString("hex");
        await prisma.invitation.deleteMany({ where: { email: guest.email } });
        await prisma.invitation.create({
          data: {
            email: guest.email,
            projectId: project.id,
            role,
            token: hashInvitationToken(token),
            inviterId,
            expiresAt,
          },
        });
        return token;
      };
      const isMember = async () =>
        (await prisma.projectMembership.count({
          where: { projectId: project.id, userId: guest.id },
        })) === 1;
      const reason = async (user: typeof guest, token: string) => {
        const result = await acceptInvitation(prisma, user, token);
        return result.ok ? "OK" : result.reason;
      };

      // Le lien transféré à un autre compte n'ouvre rien et reste utilisable.
      const token = await invite();
      assert.equal(await reason(stranger, token), "WRONG_ACCOUNT");
      assert.equal(await prisma.invitation.count(), 1);
      // La base ne connaît que l'empreinte : le jeton stocké ne sert à rien.
      const stored = await prisma.invitation.findFirstOrThrow();
      assert.notEqual(stored.token, token);
      assert.equal(await reason(guest, stored.token), "NOT_FOUND");
      assert.equal(await isMember(), false);

      assert.equal(
        await reason(guest, await invite(owner.id, "AGENT", new Date(0))),
        "EXPIRED",
      );
      assert.equal(await isMember(), false);

      // Un refus ferme le lien sans créer d'accès.
      const refused = await invite();
      assert.equal(await declineInvitation(prisma, stranger, refused), false);
      assert.equal(await declineInvitation(prisma, guest, refused), true);
      assert.equal(await reason(guest, refused), "NOT_FOUND");
      assert.equal(await isMember(), false);

      // L'inviteur retiré entre-temps ne fait plus entrer personne.
      const orphan = await invite(admin.id);
      await prisma.projectMembership.delete({ where: { id: adminRow.id } });
      assert.equal(await reason(guest, orphan), "REVOKED");
      assert.equal(await isMember(), false);

      const valid = await invite(owner.id, "VIEWER");
      assert.equal(await reason(guest, valid), "OK");
      assert.equal(await isMember(), true);
      assert.equal(await reason(guest, valid), "NOT_FOUND");

      // Une invitation ne change jamais le rôle d'un membre.
      await prisma.projectMembership.updateMany({
        where: { projectId: project.id, userId: guest.id },
        data: { role: "SUPERVISOR" },
      });
      assert.equal(await reason(guest, await invite()), "OK");
      const row = await prisma.projectMembership.findFirstOrThrow({
        where: { projectId: project.id, userId: guest.id },
      });
      assert.equal(row.role, "SUPERVISOR");
    });
  },
);

test(
  "a team never grows past the users included in its plan",
  { timeout: 600000 },
  async () => {
    await withTestDatabase(async (prisma) => {
      // Starter : 2 utilisateurs, propriétaire compris.
      assert.equal(teamSeats("starter"), 2);
      assert.equal(teamSeats("pro"), 4);
      assert.equal(teamSeats("business"), 10);
      assert.equal(teamSeats("inconnue"), 2);

      const project = await createProject(prisma, { plan: "starter" });
      const owner = await createUser(prisma, "Propriétaire");
      const agent = await createUser(prisma, "Agent");
      const guests = await Promise.all(
        ["Invité A", "Invité B", "Invité C"].map((name) => createUser(prisma, name)),
      );
      await addMember(prisma, project.id, owner.id, "OWNER");
      await addMember(prisma, project.id, agent.id, "AGENT");

      const invite = async (email: string) => {
        const token = randomBytes(32).toString("hex");
        await prisma.invitation.create({
          data: {
            email,
            projectId: project.id,
            role: "AGENT",
            token: hashInvitationToken(token),
            inviterId: owner.id,
            expiresAt: new Date(Date.now() + 60_000),
          },
        });
        return token;
      };
      const reason = async (user: { id: string; email: string }, token: string) => {
        const result = await acceptInvitation(prisma, user, token);
        return result.ok ? "OK" : result.reason;
      };
      const members = () => prisma.projectMembership.count({ where: { projectId: project.id } });

      // Équipe complète : personne n’entre, et l’invitation reste utilisable.
      const waiting = await invite(guests[0].email);
      assert.equal(await reason(guests[0], waiting), "TEAM_FULL");
      assert.equal(await members(), 2);
      assert.equal(await prisma.invitation.count({ where: { email: guests[0].email } }), 1);

      // Un membre déjà présent n’occupe pas de seconde place.
      assert.equal(await reason(agent, await invite(agent.email)), "OK");
      assert.equal(await members(), 2);

      // Passage à Pro (4 places) : la même invitation fonctionne désormais.
      await prisma.project.update({ where: { id: project.id }, data: { plan: "pro" } });
      assert.equal(await reason(guests[0], waiting), "OK");
      assert.equal(await members(), 3);

      // Dernière place disputée par deux invités en même temps : un seul entre.
      const [first, second] = await Promise.all([
        invite(guests[1].email),
        invite(guests[2].email),
      ]);
      const outcomes = await Promise.all([
        reason(guests[1], first),
        reason(guests[2], second),
      ]);
      assert.deepEqual([...outcomes].sort(), ["OK", "TEAM_FULL"]);
      assert.equal(await members(), 4);

      // Retour à Starter : les membres restent, aucune nouvelle entrée.
      await prisma.project.update({ where: { id: project.id }, data: { plan: "starter" } });
      const loser =
        outcomes[0] === "OK"
          ? { user: guests[2], token: second }
          : { user: guests[1], token: first };
      assert.equal(await reason(loser.user, loser.token), "TEAM_FULL");
      assert.equal(await members(), 4);
    });
  },
);

test("the migration hashes pending tokens the way the application does", async () => {
  await withTestDatabase(async (prisma) => {
    const rows = await prisma.$queryRawUnsafe<{ hash: string }[]>(
      `SELECT encode(sha256(convert_to('abc', 'UTF8')), 'hex') AS hash`,
    );
    assert.equal(rows[0].hash, hashInvitationToken("abc"));
  });
});
