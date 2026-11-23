"use client";

import { useEffect, useRef, useState } from "react";
import posthog from "posthog-js";
import { toast } from "sonner";
import { CheckIcon, CopyIcon, EllipsisIcon, ExternalLinkIcon, GlobeIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  androidChromeIntentUrl,
  inAppBrowserLabel,
  type InAppBrowser,
} from "@/lib/in-app-browser";

type AuthPageName = "sign-up" | "sign-in";

// Propriétés d’analyse : l’application et le système, jamais l’adresse ni le
// contenu de la page.
function eventProps(page: AuthPageName, browser: InAppBrowser) {
  return { page, app: browser.app, os: browser.os };
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Certaines vues intégrées refusent l’API : repli ci-dessous.
  }
  try {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    return copied;
  } catch {
    return false;
  }
}

/**
 * Remplace le bouton Google dans les navigateurs intégrés, où Google refuse la
 * connexion : explique pourquoi et propose de rouvrir la page dans le
 * navigateur du téléphone. L’e-mail reste la voie principale, au-dessus.
 */
export function InAppBrowserNotice({
  browser,
  page,
}: {
  browser: InAppBrowser;
  page: AuthPageName;
}) {
  const [copied, setCopied] = useState(false);
  const reported = useRef(false);
  const app = inAppBrowserLabel(browser.app);
  const where = app ? `le navigateur intégré de ${app}` : "le navigateur intégré de cette application";
  const target = browser.os === "ios" ? "Safari" : browser.os === "android" ? "Chrome" : "votre navigateur";

  useEffect(() => {
    if (reported.current) return;
    reported.current = true;
    posthog.capture("in_app_browser_shown", eventProps(page, browser));
  }, [page, browser]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 4000);
    return () => clearTimeout(timer);
  }, [copied]);

  function openInChrome() {
    const intent = androidChromeIntentUrl(window.location.href);
    posthog.capture("open_in_browser_clicked", { ...eventProps(page, browser), method: "android_intent" });
    if (intent) window.location.href = intent;
  }

  async function copyLink() {
    posthog.capture("open_in_browser_clicked", { ...eventProps(page, browser), method: "copy_link" });
    const ok = await copyText(window.location.href);
    if (ok) {
      setCopied(true);
      toast.success("Lien copié", {
        description: `Collez-le dans la barre d’adresse de ${target}.`,
        position: "top-center",
      });
    } else {
      toast.error("Copie impossible", {
        description: "Utilisez le menu ··· de l’application pour ouvrir la page dans votre navigateur.",
        position: "top-center",
      });
    }
  }

  return (
    <section
      aria-labelledby="in-app-browser-title"
      className="rounded-lg border bg-muted/40 p-4 text-sm"
    >
      <h2
        id="in-app-browser-title"
        className="flex items-center gap-2 font-sans text-sm leading-snug font-medium tracking-normal text-foreground"
      >
        <GlobeIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        {page === "sign-in" ? "Compte Google ?" : "Vous préférez Google ?"}
      </h2>
      <p className="mt-1.5 text-pretty text-muted-foreground">
        Google bloque la connexion dans {where}.{" "}
        {page === "sign-in"
          ? "Le code par e-mail fonctionne avec la même adresse, ou ouvrez cette page dans "
          : "Inscrivez-vous avec votre e-mail ci-dessus, ou ouvrez cette page dans "}
        {target} pour continuer avec Google.
      </p>

      {browser.os === "ios" && (
        <p className="mt-2 text-pretty text-muted-foreground">
          Touchez{" "}
          <span className="inline-flex translate-y-0.5 items-center rounded-sm border bg-background px-1 text-foreground">
            <EllipsisIcon aria-hidden="true" className="size-4" />
            <span className="sr-only">le menu ···</span>
          </span>{" "}
          en haut de l’écran, puis {"« Ouvrir dans Safari »"} ou{" "}
          {"« Ouvrir dans le navigateur »"}.
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2 min-[400px]:flex-row">
        {browser.os === "android" && (
          <Button type="button" variant="outline" className="min-[400px]:flex-1" onClick={openInChrome}>
            <ExternalLinkIcon data-icon="inline-start" aria-hidden="true" />
            Ouvrir dans Chrome
          </Button>
        )}
        <Button
          type="button"
          variant={browser.os === "android" ? "ghost" : "outline"}
          className="min-[400px]:flex-1"
          onClick={() => void copyLink()}
        >
          {copied ? (
            <CheckIcon data-icon="inline-start" aria-hidden="true" />
          ) : (
            <CopyIcon data-icon="inline-start" aria-hidden="true" />
          )}
          {copied ? "Lien copié" : "Copier le lien"}
        </Button>
      </div>
    </section>
  );
}
