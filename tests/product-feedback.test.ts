import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addMember,
  createProject,
  createUser,
  withTestDatabase,
} from "./helpers/database";
import {
  ProductFeedbackError,
  ProductFeedbackSchema,
  submitProductFeedback,
} from "../lib/product-feedback";

test(
  "feedback is validated, linked to known projects only and rate limited",
  { timeout: 600000 },
  async () => {
    // Chemin seul : une URL avec paramètres ou un domaine externe est refusé.
    assert.equal(
      ProductFeedbackSchema.safeParse({
        kind: "BUG",
        message: "Le bouton ne répond pas",
        contactOk: true,
        pagePath: "/projects?token=x",
      }).success,
      false,
    );
    assert.equal(
      ProductFeedbackSchema.safeParse({
        kind: "IDEA",
        message: "court",
        contactOk: true,
      }).success,
      false,
    );

    await withTestDatabase(async (prisma) => {
      const project = await createProject(prisma);
      const member = await createUser(prisma, "Inès Obame");
      const outsider = await createUser(prisma, "Externe");
      await addMember(prisma, project.id, member.id, "AGENT");
      const send = (userId: string, pagePath?: string) =>
        submitProductFeedback(prisma, userId, {
          kind: "IDEA",
          message: "Pouvoir filtrer par étiquette",
          contactOk: true,
          pagePath,
        });

      await send(member.id, `/projects/${project.id}/chat`);
      await send(outsider.id, `/projects/${project.id}/chat`);
      const rows = await prisma.productFeedback.findMany({
        orderBy: { createdAt: "asc" },
      });
      assert.equal(rows[0].projectId, project.id);
      // Un non-membre ne peut pas rattacher son retour au projet d'un autre.
      assert.equal(rows[1].projectId, null);

      for (let i = 0; i < 4; i += 1) await send(member.id);
      await assert.rejects(send(member.id), ProductFeedbackError);
    });
  },
);
