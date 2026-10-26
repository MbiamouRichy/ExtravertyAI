import { syncWhatsAppSettings } from "../lib/whatsapp-settings-sync";
import "dotenv/config";
import { workerDatabase, notifyProject } from "./shared";
import { claimAiJob, runAiJob } from "../lib/ai-jobs";
import { reconcileProviderReceipts } from "../lib/provider-reconciliation";
import { runInstinctCycle } from "../lib/ai-instinct";
import { claimKnowledgeSource, runKnowledgeSource } from "../lib/knowledge";
import { knowledgeExtractors } from "../lib/knowledge-extract";
import {
  claimMessageExtraction,
  runMessageExtraction,
} from "../lib/message-extraction";

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
        await notifyProject(job.projectId);
        await runAiJob(prisma, job);
        await notifyProject(job.projectId);
      } else await sleep(500);
    } catch {
      console.error("[ai-worker] Cycle interrompu.");
      await sleep(2000);
    }
  }
}
async function instinctLoop() {
  while (!stopping) {
    try {
      const projectId = await runInstinctCycle(prisma);
      if (projectId) await notifyProject(projectId);
    } catch {
      console.error("[ai-instinct] Cycle interrompu.");
    }
    await sleep(2000);
  }
}
async function extractionLoop() {
  while (!stopping) {
    try {
      const job = await claimMessageExtraction(prisma);
      if (job) {
        await runMessageExtraction(prisma, job);
        await notifyProject(job.projectId);
      } else await sleep(1000);
    } catch {
      console.error("[media-extraction] Cycle interrompu.");
      await sleep(2000);
    }
  }
}
// Imports PDF et pages web de la base de connaissances.
async function knowledgeLoop() {
  while (!stopping) {
    try {
      const job = await claimKnowledgeSource(prisma);
      if (job) {
        await runKnowledgeSource(prisma, job, knowledgeExtractors);
        await notifyProject(job.projectId);
      } else await sleep(2000);
    } catch {
      console.error("[knowledge] Cycle interrompu.");
      await sleep(5000);
    }
  }
}
Promise.all([main(), instinctLoop(), extractionLoop(), knowledgeLoop()])
  .catch(() => {
    stopping = true;
    console.error("[ai-worker] Arrêt sur erreur.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
