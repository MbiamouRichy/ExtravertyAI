import { test } from "node:test";
import assert from "node:assert/strict";
import { listSwitcherProjects, switcherSubtitle } from "../lib/project-switcher";
import { addMember, createUser, withTestDatabase } from "./helpers/database";

// Le sélecteur de projet ne montre que les projets dont le membre fait partie.
test("the project switcher lists only the member's own projects", { timeout: 180000 }, async () => {
  await withTestDatabase(async (prisma) => {
    const project = (name: string, numero: string) =>
      prisma.project.create({
        data: { name, numero, instanceName: crypto.randomUUID(), status: "trialing", plan: "starter" },
      });
    const shoes = await project("Chaussures Akanda", "24100000001");
    const bakery = await project("Boulangerie Owendo", "24100000002");
    const other = await project("Agence voisine", "24100000003");
    const clara = await createUser(prisma, "Clara Mba");
    const ines = await createUser(prisma, "Inès Obame");
    await addMember(prisma, shoes.id, clara.id, "OWNER");
    await addMember(prisma, bakery.id, clara.id, "AGENT");
    await addMember(prisma, other.id, ines.id, "OWNER");

    const projects = await listSwitcherProjects(prisma, clara.id);
    // Ordre alphabétique, rôle traduit, aucun projet d’un autre membre.
    assert.deepEqual(
      projects.map(({ name, role }) => [name, role]),
      [
        ["Boulangerie Owendo", "Agent"],
        ["Chaussures Akanda", "Propriétaire"],
      ],
    );
    assert.ok(projects.every((item) => item.id !== other.id));
    // Sans logo enregistré, pas d’adresse d’image.
    assert.equal(projects[0].logoUrl, null);
    // Seuls l’identifiant, le nom, le logo et le rôle partent vers le navigateur.
    assert.deepEqual(Object.keys(projects[0]).sort(), ["id", "logoUrl", "name", "role"]);
    assert.deepEqual(await listSwitcherProjects(prisma, "outsider"), []);
  });
});

test("the switcher subtitle shows the plan only to members who can see billing", () => {
  const project = { status: "active", plan: "pro", deletionPending: false };
  assert.equal(switcherSubtitle("OWNER", project), "Offre Pro");
  assert.equal(switcherSubtitle("BILLING", project), "Offre Pro");
  assert.equal(switcherSubtitle("AGENT", project), "Agent");
  assert.equal(switcherSubtitle("VIEWER", project), "Lecteur");
  assert.equal(switcherSubtitle("OWNER", { ...project, status: "trialing" }), "Essai gratuit");
  assert.equal(switcherSubtitle("OWNER", { ...project, status: "paused" }), "En pause");
  assert.equal(switcherSubtitle("OWNER", { ...project, status: "inactive" }), "Inactif");
  assert.equal(switcherSubtitle("ADMIN", { ...project, deletionPending: true }), "Suppression en cours");
});
