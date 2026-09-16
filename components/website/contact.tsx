"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Mail,
  Globe2,
  MessageCircle,
  Check,
  Phone,
} from "lucide-react";

const needs = [
  "Découvrir la solution",
  "Automatiser mon activité",
  "Obtenir de l’aide",
];
export function Contact() {
  const [need, setNeed] = useState(needs[0]);
  return (
    <main
      id="main-content"
      className="mx-auto max-w-7xl px-5 pb-20 pt-32 sm:px-8 lg:px-12 lg:pt-40"
    >
      <div className="mb-10 flex items-center gap-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        <span className="size-2 rounded-full bg-primary" /> Parlons de votre
        prochain chapitre
      </div>
      <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-20">
        <section aria-labelledby="contact-title">
          <h1
            id="contact-title"
            className="max-w-xl text-5xl! leading-[1.06]! tracking-[-0.055em]! sm:text-6xl! lg:text-7xl!"
          >
            Une conversation.
            <br />
            <span className="text-foreground dark:text-foreground">
              De nouvelles
              <br className="hidden sm:block" /> possibilités.
            </span>
          </h1>
          <p className="mt-7 max-w-md text-lg leading-relaxed text-muted-foreground">
            Votre WhatsApp peut faire plus pour votre entreprise. Racontez-nous
            votre quotidien, nous réfléchirons à la suite ensemble.
          </p>
          <div className="mt-10 flex items-center gap-3 border-t pt-6 text-sm">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
              <Globe2 className="size-4" />
            </span>
            <div>
              <p className="font-medium">Échangeons à distance</p>
              <p className="text-muted-foreground">
                Par WhatsApp, téléphone ou e-mail, où que vous travailliez.
              </p>
            </div>
          </div>
          <div className="mt-10 rounded-2xl bg-primary p-6 text-primary-foreground sm:p-8">
            <MessageCircle className="mb-5 size-6 text-primary-foreground" />
            <p className="text-xl font-medium leading-snug">
              Les bonnes solutions commencent
              <br />
              par les bonnes questions.
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-primary-foreground/80">
              Vos clients posent souvent les mêmes questions ? Votre équipe
              manque de temps pour répondre ? C’est un bon point de départ.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs text-primary-foreground">
              <Check className="size-4" /> Un premier échange, sans engagement
            </div>
          </div>
        </section>
        <section
          aria-labelledby="form-title"
          className="self-start rounded-3xl border bg-card p-6 shadow-[0_16px_60px_-35px_rgba(0,0,0,0.3)] sm:p-9"
        >
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                Préparons votre message
              </p>
              <h2
                id="form-title"
                className="text-2xl font-semibold tracking-tight"
              >
                Parlons sur WhatsApp
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Décrivez votre besoin pour préparer un message à notre équipe.
                Vous le relirez et l’enverrez vous-même dans WhatsApp.
              </p>
            </div>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-foreground dark:bg-muted dark:text-foreground">
              <ArrowUpRight className="size-5" />
            </span>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const values = new FormData(event.currentTarget);
              const text = `Bonjour ExtravertyAI !\nJe m'appelle ${values.get("name")}, de ${values.get("business")}.\nMon besoin : ${need}.\n${values.get("message")}`;
              window.location.assign(
                `https://wa.me/24176205629?text=${encodeURIComponent(text)}`,
              );
            }}
            className="space-y-6"
          >
            <fieldset>
              <legend className="mb-3 text-sm font-medium">Je souhaite…</legend>
              <div className="flex flex-wrap gap-2">
                {needs.map((value) => (
                  <label
                    key={value}
                    className={`relative cursor-pointer rounded-full border px-4 py-2.5 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${need === value ? "border-border bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >
                    <input
                      type="radio"
                      name="need"
                      value={value}
                      checked={need === value}
                      onChange={() => setNeed(value)}
                      className="sr-only"
                    />
                    {value}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="contact-name"
                  className="mb-2 block text-sm font-medium"
                >
                  Votre nom <span className="text-muted-foreground">*</span>
                </label>
                <input
                  id="contact-name"
                  name="name"
                  autoComplete="name"
                  placeholder="Marie Dupont"
                  required
                  maxLength={100}
                  className="h-12 w-full rounded-xl border bg-background px-4 text-base outline-none focus:border-border focus:ring-2 focus:ring-ring/20"
                />
              </div>
              <div>
                <label
                  htmlFor="contact-business"
                  className="mb-2 block text-sm font-medium"
                >
                  Votre entreprise{" "}
                  <span className="text-muted-foreground">*</span>
                </label>
                <input
                  id="contact-business"
                  name="business"
                  autoComplete="organization"
                  placeholder="Le nom de votre activité"
                  required
                  maxLength={150}
                  className="h-12 w-full rounded-xl border bg-background px-4 text-base outline-none focus:border-border focus:ring-2 focus:ring-ring/20"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="contact-message"
                className="mb-2 block text-sm font-medium"
              >
                Quelques mots sur votre besoin{" "}
                <span className="text-muted-foreground">*</span>
              </label>
              <textarea
                id="contact-message"
                name="message"
                rows={4}
                required
                maxLength={1500}
                placeholder="Votre activité, les questions de vos clients, ce que vous aimeriez simplifier…"
                className="w-full resize-y rounded-xl border bg-background p-4 text-base outline-none focus:border-border focus:ring-2 focus:ring-ring/20"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                * Champs requis
              </p>
            </div>
            <button
              type="submit"
              className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              Ouvrir mon message dans WhatsApp <ArrowRight className="size-4 shrink-0" />
            </button>
            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              Vous pourrez relire votre message avant de l’envoyer dans
              WhatsApp. Vos informations ne sont pas enregistrées par ce
              formulaire.{" "}
              <Link
                href="/donneesEtConfidentialite"
                className="underline underline-offset-4"
              >
                Confidentialité
              </Link>
            </p>
          </form>
          <div className="mt-7 flex items-center gap-3 border-t pt-6 text-sm text-muted-foreground">
            <Mail className="size-4 shrink-0" />
            <span>
              Plutôt par e-mail ?<br />
              <a
                href="mailto:extravertyai@gmail.com"
                className="break-all font-medium text-foreground underline-offset-4 hover:underline"
              >
                extravertyai@gmail.com
              </a>
            </span>
          </div>
        </section>
      </div>
      <section
        aria-label="Autres moyens de contact"
        className="mt-16 grid gap-6 border-y py-7 sm:grid-cols-3 lg:mt-24"
      >
        <div>
          <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
            Une question rapide
          </p>
          <a
            href="tel:+24176205629"
            className="inline-flex min-h-10 items-center gap-2 text-sm font-medium"
          >
            <Phone className="size-4" /> +241 76 20 56 29{" "}
            <ArrowUpRight className="size-3.5" />
          </a>
        </div>
        <div>
          <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
            Déjà client ?
          </p>
          <Link
            href="/projects"
            className="inline-flex min-h-10 items-center gap-2 text-sm font-medium"
          >
            Accéder à mon espace <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <div>
          <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
            Avant de commencer
          </p>
          <Link
            href="/#faq"
            className="inline-flex min-h-10 items-center gap-2 text-sm font-medium"
          >
            Les questions fréquentes <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
