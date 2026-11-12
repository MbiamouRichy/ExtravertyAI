import { syncWhatsAppSettings } from "../lib/whatsapp-settings-sync";
import "dotenv/config";
import { workerDatabase, notifyProject } from "./shared";
import { flushWorkerMonitoring, initWorkerMonitoring, reportWorkerError } from "./monitoring";
import { claimAiJob, runAiJob } from "../lib/ai-jobs";
import { reconcileProviderReceipts } from "../lib/provider-reconciliation";
import { runInstinctCycle } from "../lib/ai-instinct";
import { runFollowUpTick } from "../lib/follow-ups";
import { claimKnowledgeSource, runKnowledgeSource } from "../lib/knowledge";
import { knowledgeExtractors } from "../lib/knowledge-extract";
import {
  claimMessageExtraction,
  runMessageExtraction,
} from "../lib/message-extraction";

initWorkerMonitoring("ai-worker");
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
    } catch (error) {
      reportWorkerError("[ai-worker] Cycle interrompu.", error);
      await sleep(2000);
    }
  }
}
async function instinctLoop() {
  while (!stopping) {
    try {
      const projectId = await runInstinctCycle(prisma);
      if (projectId) await notifyProject(projectId);
    } catch (error) {
      reportWorkerError("[ai-instinct] Cycle interrompu.", error);
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
    } catch (error) {
      reportWorkerError("[media-extraction] Cycle interrompu.", error);
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
    } catch (error) {
      reportWorkerError("[knowledge] Cycle interrompu.", error);
      await sleep(5000);
    }
  }
}
// Relances automatiques (Business) : rien d’urgent à la seconde. On enchaîne
// après une relance, sinon on revérifie toutes les 30 secondes.
async function followUpLoop() {
  while (!stopping) {
    let busy = false;
    try {
      const tick = await runFollowUpTick(prisma);
      busy = !!tick;
      if (tick?.outcome === "sent") await notifyProject(tick.projectId);
    } catch (error) {
      reportWorkerError("[follow-ups] Cycle interrompu.", error);
    }
    // Attente découpée : l’arrêt du worker n’attend pas la fin du délai.
    for (let waited = 0; waited < (busy ? 1000 : 30000) && !stopping; waited += 1000)
      await sleep(1000);
  }
}
Promise.all([main(), instinctLoop(), extractionLoop(), knowledgeLoop(), followUpLoop()])
  .catch((error) => {
    stopping = true;
    reportWorkerError("[ai-worker] Arrêt sur erreur.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await flushWorkerMonitoring();
    await prisma.$disconnect();
  });
