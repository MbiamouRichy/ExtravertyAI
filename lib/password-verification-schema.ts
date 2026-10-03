import { z } from "zod";

// Preserve the existing password exactly; do not impose new-password rules.
export const passwordVerificationSchema = z.object({
  password: z.string("Le mot de passe est requis.")
    .min(1, "Saisissez votre mot de passe actuel.")
    .max(255, "Le mot de passe est trop long."),
});
