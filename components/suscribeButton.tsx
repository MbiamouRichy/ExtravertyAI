"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button"; // Votre composant button
import { createCheckoutSession } from "@/app/actions/stripe-actions";

export function SubscribeButton({ priceId }: { priceId: string }) {
    const [loading, setLoading] = useState(false);
    // SÉCURITÉ : On vérifie avant même de cliquer
    const isConfigured = priceId && priceId.startsWith("price_");

    const handleSubscribe = async () => {
        if (!isConfigured) {
            alert("Erreur de configuration : Identifiant de prix invalide.");
            return;
        }
        setLoading(true);
        try {
            const { url } = await createCheckoutSession(priceId);
            if (url) window.location.assign(url); // Redirection vers Stripe
        } catch (error) {
            console.error("Erreur de paiement:", error);
            alert("Une erreur est survenue lors de la redirection vers Stripe.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button onClick={handleSubscribe} disabled={loading}>
            {loading ? "Chargement..." : "S'abonner"}
        </Button>
    );
}