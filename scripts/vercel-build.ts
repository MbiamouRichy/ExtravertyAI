// Commande de build Vercel (`npm run vercel-build`).
//
// 1. Compile l'application (`npm run build`). Aucune page n'interroge la base
//    pendant la compilation : un build qui échoue ne la touche donc jamais.
// 2. Si le build réussit et vise la production ou la préversion, applique les
//    migrations (`npm run db:deploy`) sur la base de son environnement. En cas
//    d'échec, le déploiement est annulé et la version en ligne reste servie.
//
// Les migrations s'exécutent pendant que l'ancienne version sert encore les
// visiteurs : une suppression de colonne doit attendre une version qui ne
// l'utilise plus (voir docs/vercel-preproduction.md).
import { spawnSync } from "node:child_process";
import { buildMigrationDecision } from "../lib/build-migrations";

function run(script: string) {
  const result = spawnSync("npm", ["run", script], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const decision = buildMigrationDecision(process.env);

// Échoue avant de compiler si la base à migrer n'est pas configurée.
if (decision.migrate && !process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  console.error(
    `Migrations attendues (${decision.reason}), mais ni DATABASE_URL ni DIRECT_URL n'est défini pour cet environnement.`,
  );
  process.exit(1);
}

run("build");

if (!decision.migrate) {
  console.log(`\nMigrations ignorées : ${decision.reason}.`);
  process.exit(0);
}
console.log(`\nMigrations : application (${decision.reason}).`);
run("db:deploy");
