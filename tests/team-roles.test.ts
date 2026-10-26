import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { PGlite } from "@electric-sql/pglite";
import { PrismaClient, Role } from "../src/generated/prisma/client";
import {
  PROJECT_ROLES,
  assignableRoles,
  can,
  canManageMember,
  canOpenPage,
  homePath,
  rolesWith,
  type ProjectPermission,
} from "../lib/project-permissions";
import * as permissions from "../lib/project-permissions";
import * as rateLimit from "../lib/rate-limit";
import * as recentSession from "../lib/recent-session";
import {
  ConversationWorkflowError,
  assignConversation,
  assignNextConversation,
  assignableMembers,
  setConversationResolved,
} from "../lib/conversation-workflow";
import { conversationUnreadCounts } from "../lib/conversation-reads";
import {
  SettingsError,
  requireProjectAdmin,
  requireProjectPermission,
} from "../lib/project-settings";
import {
  addMember,
  createProject,
  createUser,
  ingestText,
  withTestDatabase,
} from "./helpers/database";

// Matrice validée : chaque ligne liste les rôles autorisés, dans l'ordre de PROJECT_ROLES.
const MATRIX: Record<ProjectPermission, string[]> = {
  "stats.view": ["OWNER", "ADMIN", "SUPERVISOR", "VIEWER"],
  "reports.manage": ["OWNER", "ADMIN"],
  "conversations.handle": ["OWNER", "ADMIN", "SUPERVISOR", "AGENT"],
  "conversations.dispatch": ["OWNER", "ADMIN", "SUPERVISOR"],
  "contacts.view": ["OWNER", "ADMIN", "SUPERVISOR"],
  "contacts.export": ["OWNER", "ADMIN"],
  "pipeline.view": ["OWNER", "ADMIN", "SUPERVISOR", "AGENT"],
  "project.manage": ["OWNER", "ADMIN"],
  "team.manage": ["OWNER", "ADMIN"],
  "billing.view": ["OWNER", "ADMIN", "BILLING"],
  "billing.manage": ["OWNER", "BILLING"],
  "project.own": ["OWNER"],
};

test("the permission matrix matches the validated role definitions", () => {
  // Les rôles Prisma et ceux du module de droits ne doivent jamais diverger.
  assert.deepEqual(
    new Set(Object.values(Role)),
    new Set(PROJECT_ROLES),
  );
  for (const [permission, roles] of Object.entries(MATRIX)) {
    assert.deepEqual(
      PROJECT_ROLES.filter((role) => can(role, permission as ProjectPermission)),
      roles,
      permission,
    );
    assert.deepEqual(rolesWith(permission as ProjectPermission), roles);
  }
  // Rôle inconnu, ancien nom ou valeur forgée : aucun droit.
  for (const role of ["USER", "owner", "", null, undefined, "__proto__"]) {
    for (const permission of Object.keys(MATRIX))
      assert.equal(can(role, permission as ProjectPermission), false);
  }
});

test("viewers never reach message content and billing only reaches billing", () => {
  for (const page of ["chat", "contacts", "pipeline", "broadcasts", "knowledge", "settings", "team", "integrations"] as const)
    assert.equal(canOpenPage("VIEWER", page), false, page);
  for (const page of ["", "analytics", "reports"] as const)
    assert.equal(canOpenPage("VIEWER", page), true, page);
  for (const page of ["", "analytics", "reports", "chat", "contacts", "team", "settings"] as const)
    assert.equal(canOpenPage("BILLING", page), false, page);
  assert.equal(canOpenPage("BILLING", "billing"), true);
  assert.equal(canOpenPage("SUPERVISOR", "billing"), false);
  assert.equal(canOpenPage("SUPERVISOR", "settings"), false);
  assert.equal(canOpenPage("SUPERVISOR", "team"), false);

  assert.equal(homePath("p", "OWNER"), "/projects/p");
  assert.equal(homePath("p", "VIEWER"), "/projects/p");
  assert.equal(homePath("p", "AGENT"), "/projects/p/chat");
  assert.equal(homePath("p", "BILLING"), "/projects/p/billing");
  assert.equal(homePath("p", "USER"), "/projects");
});

test("only the owner appoints administrators and nobody hands out ownership", () => {
  assert.deepEqual(assignableRoles("OWNER"), ["ADMIN", "SUPERVISOR", "AGENT", "VIEWER", "BILLING"]);
  assert.deepEqual(assignableRoles("ADMIN"), ["SUPERVISOR", "AGENT", "VIEWER", "BILLING"]);
  for (const role of ["SUPERVISOR", "AGENT", "VIEWER", "BILLING", "USER"])
    assert.deepEqual(assignableRoles(role), [], role);

  assert.equal(canManageMember("OWNER", "ADMIN"), true);
  assert.equal(canManageMember("ADMIN", "ADMIN"), false);
  assert.equal(canManageMember("ADMIN", "SUPERVISOR"), true);
  assert.equal(canManageMember("OWNER", "OWNER"), false);
  // Régression : un agent ne touche à aucun rôle.
  assert.equal(canManageMember("AGENT", "ADMIN"), false);
  assert.equal(canManageMember("SUPERVISOR", "AGENT"), false);
});

test(
  "the migration renames USER to AGENT without changing anyone's access",
  { timeout: 120000 },
  async () => {
    const db = await PGlite.create();
    try {
      const folders = (await readdir("prisma/migrations"))
        .filter((name) => /^\d/.test(name))
        .sort();
      const index = folders.indexOf("202610260004_team_roles");
      assert.ok(index > 0);
      const sql = (folder: string) =>
        readFile(`prisma/migrations/${folder}/migration.sql`, "utf8");
      for (const folder of folders.slice(0, index)) await db.exec(await sql(folder));

      await db.exec(`
        INSERT INTO "user" (id, name, email, "globalRole", "updatedAt") VALUES
          ('u1', 'Ana', 'ana@example.test', 'USER', NOW()),
          ('u2', 'Bob', 'bob@example.test', 'ADMIN', NOW());
        INSERT INTO project (id, name, numero, "instanceName", status, "updatedAt")
          VALUES ('p', 'Test', '24100000000', 'i', 'active', NOW());
        INSERT INTO project_membership (id, "userId", "projectId", role) VALUES
          ('m1', 'u1', 'p', 'USER'), ('m2', 'u2', 'p', 'OWNER');
        INSERT INTO invitation (id, email, "projectId", token, "inviterId", "expiresAt")
          VALUES ('i1', 'new@example.test', 'p', 't', 'u2', NOW() + interval '1 day');
      `);
      await db.exec(await sql(folders[index]));
      for (const folder of folders.slice(index + 1)) await db.exec(await sql(folder));

      const rows = async (query: string) => (await db.query(query)).rows;
      assert.deepEqual(
        await rows(`SELECT id, role::text FROM project_membership ORDER BY id`),
        [
          { id: "m1", role: "AGENT" },
          { id: "m2", role: "OWNER" },
        ],
      );
      assert.deepEqual(await rows(`SELECT role::text FROM invitation`), [{ role: "AGENT" }]);
      // Le rôle global garde ses valeurs, dans son propre type.
      assert.deepEqual(
        await rows(`SELECT "globalRole"::text AS g FROM "user" ORDER BY id`),
        [{ g: "USER" }, { g: "ADMIN" }],
      );
      // Ordre du type : un tri décroissant montre le propriétaire d'abord.
      assert.deepEqual(
        (await rows(`SELECT unnest(enum_range(NULL::"Role"))::text AS r`)).map(
          (row) => (row as { r: string }).r,
        ),
        ["BILLING", "VIEWER", "AGENT", "SUPERVISOR", "ADMIN", "OWNER"],
      );
      await db.exec(`INSERT INTO invitation (id, email, "projectId", token, "inviterId", "expiresAt")
        VALUES ('i2', 'x@example.test', 'p', 't2', 'u2', NOW())`);
      assert.deepEqual(await rows(`SELECT role::text FROM invitation WHERE id = 'i2'`), [{ role: "AGENT" }]);
    } finally {
      await db.close();
    }
  },
);

test(
  "viewers and billing never reach conversations; supervisors dispatch them",
  { timeout: 600000 },
  async () => {
    await withTestDatabase(async (prisma) => {
      const project = await createProject(prisma, { plan: "business" });
      const members: Record<string, string> = {};
      for (const role of PROJECT_ROLES) {
        const user = await createUser(prisma, role);
        await addMember(prisma, project.id, user.id, role);
        members[role] = user.id;
      }
      const contact = await ingestText(prisma, project.id, "Bonjour", "24199999999@s.whatsapp.net");
      // La répartition automatique ne doit pas l'avoir confiée à un lecteur.
      await prisma.contact.update({
        where: { id: contact.id },
        data: { assigneeId: null, assignedAt: null },
      });
      const target = { projectId: project.id, contactId: contact.id };

      for (const role of ["VIEWER", "BILLING"]) {
        await assert.rejects(
          setConversationResolved(prisma, { ...target, userId: members[role], resolved: true }),
          ConversationWorkflowError,
          role,
        );
        await assert.rejects(
          assignConversation(prisma, { ...target, userId: members[role], assigneeId: members[role] }),
          ConversationWorkflowError,
          role,
        );
        assert.deepEqual(await assignableMembers(prisma, project.id, members[role]), [], role);
        assert.equal(
          (await conversationUnreadCounts(prisma, project.id, members[role], [contact.id])).size,
          0,
          role,
        );
      }

      // Seuls les rôles qui traitent les conversations peuvent en recevoir une.
      const assignable = await assignableMembers(prisma, project.id, members.AGENT);
      assert.deepEqual(
        new Set(assignable.map((member) => member.role)),
        new Set(["OWNER", "ADMIN", "SUPERVISOR", "AGENT"]),
      );
      await assert.rejects(
        assignConversation(prisma, { ...target, userId: members.AGENT, assigneeId: members.VIEWER }),
        /accès à la messagerie/,
      );

      // L'agent garde ses droits actuels ; la répartition revient aux superviseurs et plus.
      await assignConversation(prisma, { ...target, userId: members.AGENT, assigneeId: members.AGENT });
      await assert.rejects(
        assignNextConversation(prisma, { projectId: project.id, userId: members.AGENT, assigneeId: members.SUPERVISOR }),
        /répartissent/,
      );
      await assignConversation(prisma, { ...target, userId: members.SUPERVISOR, assigneeId: null });
      await assert.rejects(
        assignNextConversation(prisma, { projectId: project.id, userId: members.SUPERVISOR, assigneeId: members.BILLING }),
        /accès à la messagerie/,
      );
      const next = await assignNextConversation(prisma, {
        projectId: project.id,
        userId: members.SUPERVISOR,
        assigneeId: members.AGENT,
      });
      assert.equal(next.contactId, contact.id);
    });
  },
);

test(
  "automatic dispatch skips online viewers and billing members",
  { timeout: 600000 },
  async () => {
    await withTestDatabase(async (prisma) => {
      const project = await createProject(prisma, { plan: "business" });
      const owner = await createUser(prisma, "Owner");
      const viewer = await createUser(prisma, "Viewer");
      const billing = await createUser(prisma, "Billing");
      const supervisor = await createUser(prisma, "Supervisor");
      await addMember(prisma, project.id, owner.id, "OWNER");
      await addMember(prisma, project.id, viewer.id, "VIEWER");
      await addMember(prisma, project.id, billing.id, "BILLING");
      for (const user of [owner, viewer, billing])
        await prisma.$executeRaw`INSERT INTO user_presence ("userId", "tabId", "lastSeenAt", "lastActiveAt")
          VALUES (${user.id}, 'tab', NOW(), NOW())`;
      const first = await ingestText(prisma, project.id, "Bonjour", "24111111111@s.whatsapp.net");
      assert.equal(
        (await prisma.contact.findUniqueOrThrow({ where: { id: first.id } })).assigneeId,
        null,
      );

      await addMember(prisma, project.id, supervisor.id, "SUPERVISOR");
      await prisma.$executeRaw`INSERT INTO user_presence ("userId", "tabId", "lastSeenAt", "lastActiveAt")
        VALUES (${supervisor.id}, 'tab', NOW(), NOW())`;
      const second = await ingestText(prisma, project.id, "Bonsoir", "24122222222@s.whatsapp.net");
      assert.equal(
        (await prisma.contact.findUniqueOrThrow({ where: { id: second.id } })).assigneeId,
        supervisor.id,
      );
    });
  },
);

test(
  "settings stay with managers and billing management moves to the billing role",
  { timeout: 600000 },
  async () => {
    await withTestDatabase(async (prisma) => {
      const project = await createProject(prisma);
      const ids: Record<string, string> = {};
      for (const role of PROJECT_ROLES) {
        const user = await createUser(prisma, role);
        await addMember(prisma, project.id, user.id, role);
        ids[role] = user.id;
      }
      const allowed = async (run: () => Promise<unknown>) =>
        run().then(
          () => true,
          (error) => {
            assert.ok(error instanceof SettingsError);
            return false;
          },
        );
      for (const role of PROJECT_ROLES) {
        assert.equal(
          await prisma.$transaction((tx) => allowed(() => requireProjectAdmin(tx, project.id, ids[role]))),
          role === "OWNER" || role === "ADMIN",
          role,
        );
        assert.equal(
          await prisma.$transaction((tx) =>
            allowed(() => requireProjectPermission(tx, project.id, ids[role], "billing.manage")),
          ),
          role === "OWNER" || role === "BILLING",
          role,
        );
      }
    });
  },
);

/** Charge app/actions/team.ts contre une vraie base, session simulée. */
function loadTeamActions(prisma: PrismaClient, userId: string, emailFails = false) {
  const sent: string[] = [];
  const modules: Record<string, unknown> = {
    "next/cache": { revalidatePath: () => undefined },
    "@/lib/prisma": { default: prisma },
    "@/lib/auth-server": {
      getSession: async () => ({
        user: { id: userId, name: "Testeur" },
        session: { createdAt: new Date() },
      }),
    },
    crypto: { default: crypto },
    "@/src/generated/prisma/client": { Role },
    "@/lib/resend": {
      resend: {
        emails: {
          send: async (mail: { to: string }) => {
            sent.push(mail.to);
            return emailFails ? { data: null, error: { message: "domaine refusé" } } : { data: { id: "e" }, error: null };
          },
        },
      },
    },
    "@/components/emailTemplate/invitationEmail": { ProjectInvitationEmail: () => "" },
    "@/components/emailTemplate/projectMemberConfirmationEmail": {
      ProjectMemberConfirmationEmail: () => "",
    },
    zod: { default: z, z },
    "@/lib/recent-session": recentSession,
    "@/lib/rate-limit": rateLimit,
    "@/lib/project-permissions": permissions,
  };
  const exports: Record<string, (...args: never[]) => Promise<{ success: boolean; error?: string }>> = {};
  const source = ts.transpileModule(readFileSync("app/actions/team.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  runInNewContext(source, {
    exports,
    console: { error: () => {} },
    process: { env: { NEXT_PUBLIC_APP_URL: "https://app.example.test" } },
    require: (name: string) => {
      assert.ok(name in modules, name);
      return modules[name];
    },
  });
  return {
    sent,
    updateMemberRole: exports.updateMemberRole as unknown as (input: {
      projectId: string;
      membershipId: string;
      newRole: string;
    }) => Promise<{ success: boolean; error?: string }>,
    inviteTeamMember: exports.inviteTeamMember as unknown as (
      email: string,
      role: string,
      projectId: string,
    ) => Promise<{ success: boolean; error?: string }>,
    removeTeamMember: exports.removeTeamMember as unknown as (
      membershipId: string,
      projectId: string,
    ) => Promise<{ success: boolean; error?: string }>,
  };
}

test(
  "team actions enforce the role hierarchy on the server",
  { timeout: 600000 },
  async () => {
    await withTestDatabase(async (prisma) => {
      const project = await createProject(prisma);
      const users: Record<string, string> = {};
      const memberships: Record<string, string> = {};
      for (const role of PROJECT_ROLES) {
        const user = await createUser(prisma, role);
        users[role] = user.id;
        memberships[role] = (await addMember(prisma, project.id, user.id, role)).id;
      }
      const roleOf = async (role: string) =>
        (await prisma.projectMembership.findUniqueOrThrow({ where: { id: memberships[role] } })).role;

      // Régression : un agent ne peut plus rétrograder un administrateur.
      const agent = loadTeamActions(prisma, users.AGENT);
      const demote = await agent.updateMemberRole({
        projectId: project.id,
        membershipId: memberships.ADMIN,
        newRole: "AGENT",
      });
      assert.equal(demote.success, false);
      assert.equal(await roleOf("ADMIN"), "ADMIN");
      assert.equal((await agent.removeTeamMember(memberships.VIEWER, project.id)).success, false);
      assert.equal((await agent.inviteTeamMember("x@example.test", "AGENT", project.id)).success, false);

      // Un administrateur ne crée ni administrateur ni propriétaire.
      const admin = loadTeamActions(prisma, users.ADMIN);
      for (const newRole of ["ADMIN", "OWNER"]) {
        assert.equal(
          (await admin.updateMemberRole({ projectId: project.id, membershipId: memberships.AGENT, newRole })).success,
          false,
          newRole,
        );
        assert.equal(
          (await admin.inviteTeamMember("new@example.test", newRole, project.id)).success,
          false,
          newRole,
        );
      }
      assert.equal(
        (await admin.updateMemberRole({ projectId: project.id, membershipId: memberships.AGENT, newRole: "SUPERVISOR" })).success,
        true,
      );
      assert.equal(await roleOf("AGENT"), "SUPERVISOR");
      assert.equal(
        (await admin.inviteTeamMember("  Lecteur@Example.TEST ", "VIEWER", project.id)).success,
        true,
      );
      const invitation = await prisma.invitation.findFirstOrThrow({ where: { projectId: project.id } });
      assert.equal(invitation.email, "lecteur@example.test");
      assert.equal(invitation.role, "VIEWER");
      assert.equal((await admin.inviteTeamMember("not-an-email", "VIEWER", project.id)).success, false);

      // Le propriétaire nomme un administrateur mais ne crée pas de second propriétaire.
      const owner = loadTeamActions(prisma, users.OWNER);
      assert.equal(
        (await owner.updateMemberRole({ projectId: project.id, membershipId: memberships.BILLING, newRole: "OWNER" })).success,
        false,
      );
      assert.equal((await owner.inviteTeamMember("boss@example.test", "OWNER", project.id)).success, false);
      assert.equal(
        (await owner.updateMemberRole({ projectId: project.id, membershipId: memberships.BILLING, newRole: "ADMIN" })).success,
        true,
      );
      assert.equal(await roleOf("BILLING"), "ADMIN");

      // Un e-mail qui échoue n'annule pas l'ajout d'un compte existant…
      const outsider = await createUser(prisma, "Externe");
      const failing = loadTeamActions(prisma, users.OWNER, true);
      const added = await failing.inviteTeamMember(outsider.email, "VIEWER", project.id);
      assert.equal(added.success, true);
      assert.match((added as { warning?: string }).warning ?? "", /e-mail/);
      assert.ok(await prisma.projectMembership.findFirst({ where: { projectId: project.id, userId: outsider.id, role: "VIEWER" } }));
      // …mais une invitation sans e-mail est refusée et ne reste pas en base.
      const pending = await failing.inviteTeamMember("absent@example.test", "AGENT", project.id);
      assert.equal(pending.success, false);
      assert.equal(await prisma.invitation.count({ where: { email: "absent@example.test" } }), 0);
    });
  },
);
