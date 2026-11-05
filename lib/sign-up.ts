import { z } from "zod";

// Shared by the sign-up form (client) and lib/auth.ts (server).

// Sent by the sign-up form when it asks for a code: an unknown address then
// gets a code to create its account. The sign-in form never sends it, so a
// code requested there for an unknown address is still never emailed.
export const SIGN_UP_INTENT_HEADER = "x-extraverty-intent";
export const SIGN_UP_INTENT = "sign-up";

export const accountNameSchema = z
  .string()
  .trim()
  .min(2, "Votre nom doit contenir au moins 2 caractères.")
  .max(50, "Votre nom doit contenir au maximum 50 caractères.");

// Better Auth's own bounds (8 to 128).
export const accountPasswordSchema = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
  .max(128, "Le mot de passe doit contenir au maximum 128 caractères.");
