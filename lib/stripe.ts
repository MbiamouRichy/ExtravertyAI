import Stripe from "stripe";

let client: Stripe | undefined;

/**
 * Client Stripe créé au premier usage, et non au chargement du module.
 *
 * Sans STRIPE_SECRET_KEY (facturation par Polar), l'application se construit
 * et démarre normalement : seul un appel réel à Stripe échoue, avec une erreur
 * explicite. Les appels Stripe ne partent que pour un projet facturé par
 * Stripe, ou quand une clé est configurée.
 */
function stripeClient(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_NOT_CONFIGURED: STRIPE_SECRET_KEY est absent.");
  client = new Stripe(key, {
    apiVersion: "2026-06-24.dahlia",
    typescript: true,
  });
  return client;
}

/** Même usage qu'un client Stripe (`stripe.subscriptions.retrieve(...)`), créé à la demande. */
export const stripe = new Proxy({} as Stripe, {
  get(_target, property) {
    // Pas une promesse : un `await` ou un `return` asynchrone ne doit pas créer le client.
    if (property === "then") return undefined;
    const instance = stripeClient();
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
