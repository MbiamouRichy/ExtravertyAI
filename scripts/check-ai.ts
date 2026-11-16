import "dotenv/config";
import { generateReply } from "../lib/ai-jobs";
import { AGENT_DEFAULTS } from "../lib/agent-config";
import { generateConversationSummary } from "../lib/conversation-summary";

// Conversation fictive : aucune donnée client, rien d’enregistré ni d’envoyé.
async function check(model: string, label: string) {
  process.env.OPENROUTER_MODEL = model;
  // Chaque modèle est testé seul : une bascule masquerait son échec.
  delete process.env.OPENROUTER_FALLBACK_MODEL;
  const reply = await generateReply(
    [{ role: "user", content: "Bonjour, proposez-vous des livraisons ?" }],
    "Boutique de démonstration",
    "Prospect de test",
    {
      ...AGENT_DEFAULTS,
      agentName: "Nova",
      agentSystemMessage:
        "Tu accueilles les prospects d’une boutique de démonstration. Les modalités de livraison ne sont pas renseignées. Propose de les vérifier avec un conseiller sans inventer de conditions.",
    },
  );
  console.log(`[${label}] ${model} — réponse :`, reply);
  const summary = await generateConversationSummary([
    { senderType: "CLIENT", type: "TEXT", content: "Bonjour, proposez-vous des livraisons ?" },
    { senderType: "BOT", type: "TEXT", content: reply },
  ]);
  console.log(`[${label}] ${model} — résumé JSON valide :`, summary.summary.slice(0, 120));
}

async function main() {
  const primary = process.env.OPENROUTER_MODEL;
  const backup = process.env.OPENROUTER_FALLBACK_MODEL?.trim();
  if (!primary) throw new Error("AI_CONFIG_MISSING");
  await check(primary, "principal");
  if (backup) await check(backup, "secours");
  else console.log("OPENROUTER_FALLBACK_MODEL absent : aucun secours à vérifier.");
  console.log(
    "Test synthétique uniquement : aucune donnée enregistrée, aucun envoi WhatsApp.",
  );
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "AI_CHECK_FAILED");
  process.exitCode = 1;
});
