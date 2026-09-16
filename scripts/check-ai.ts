import "dotenv/config";
import { generateReply } from "../lib/ai-jobs";
import { AGENT_DEFAULTS } from "../lib/agent-config";
async function main() {
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
  console.log("Réponse du modèle reçue :", reply);
  console.log(
    "Test synthétique uniquement : aucune donnée enregistrée, aucun envoi WhatsApp.",
  );
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "AI_CHECK_FAILED");
  process.exitCode = 1;
});
