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

test("the migration hashes pending tokens the way the application does", async () => {
  await withTestDatabase(async (prisma) => {
    const rows = await prisma.$queryRawUnsafe<{ hash: string }[]>(
      `SELECT encode(sha256(convert_to('abc', 'UTF8')), 'hex') AS hash`,
    );
    assert.equal(rows[0].hash, hashInvitationToken("abc"));
  });
});
