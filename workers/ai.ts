import { syncWhatsAppSettings } from "../lib/whatsapp-settings-sync";
import "dotenv/config";
import { workerDatabase, notifyProject } from "./shared";
import { claimAiJob, runAiJob } from "../lib/ai-jobs";
import { reconcileProviderReceipts } from "../lib/provider-reconciliation";

const prisma = workerDatabase();
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function main() {
  if (!process.env.OPENROUTER_API_KEY || !process.env.OPENROUTER_MODEL)
    throw new Error("Configuration IA manquante.");
  while (!stopping) {
    try {
      await syncWhatsAppSettings(prisma);
      const changed = await reconcileProviderReceipts(prisma);
      for (const projectId of changed) await notifyProject(projectId);
      const job = await claimAiJob(prisma);
      if (job) {
        await runAiJob(prisma, job);
        await notifyProject(job.projectId);
      } else await sleep(500);
    } catch {
      console.error("[ai-worker] Cycle interrompu.");
      await sleep(2000);
    }
  }
}
main()
  .catch(() => {
    console.error("[ai-worker] Arrêt sur erreur.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
