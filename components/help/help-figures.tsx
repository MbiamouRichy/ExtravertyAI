import { ArrowRight, AtSign, ChevronDown, ImagePlus, Plus, User } from "lucide-react";

import type { HelpFigureId } from "@/lib/help-center/content";
import { formatPlanPrice, PRICING_PLANS } from "@/lib/pricing";

import { ConnectionFigure, TestChatFigure, VerificationFigure } from "./help-figures-interactive";
import {
  MockButton,
  MockField,
  MockHeading,
  MockLabel,
  MockOption,
  MockStepper,
  MockWindow,
  Pin,
} from "./help-mockups";

const JOURNEY = [
  { title: "Compte", detail: "code e-mail ou Google", time: "1 min" },
  { title: "Projet", detail: "nom, pays, forfait", time: "2 min" },
  { title: "Numéro", detail: "vérifié + essai", time: "1 min" },
  { title: "Assistant", detail: "6 écrans guidés", time: "8 min" },
  { title: "WhatsApp", detail: "QR code scanné", time: "1 min" },
];

function JourneyFigure() {
  return (
    <>
      <svg viewBox="0 0 760 160" className="hidden w-full sm:block" aria-hidden="true">
        {JOURNEY.slice(0, -1).map((_, index) => (
          <line
            key={index}
            x1={98 + index * 152}
            y1={44}
            x2={206 + index * 152}
            y2={44}
            className="stroke-border"
            strokeWidth={2}
          />
        ))}
        {JOURNEY.map((step, index) => {
          const x = 76 + index * 152;
          const last = index === JOURNEY.length - 1;
          return (
            <g key={step.title}>
              <circle
                cx={x}
                cy={44}
                r={22}
                strokeWidth={2}
                className={last ? "fill-foreground stroke-foreground" : "fill-background stroke-foreground"}
              />
              <text
                x={x}
                y={49}
                textAnchor="middle"
                className={last ? "fill-background font-mono text-[14px] font-semibold" : "fill-foreground font-mono text-[14px] font-semibold"}
              >
                {index + 1}
              </text>
              <text x={x} y={96} textAnchor="middle" className="fill-foreground font-heading text-[15px] font-bold">
                {step.title}
              </text>
              <text x={x} y={116} textAnchor="middle" className="fill-muted-foreground text-[12px]">
                {step.detail}
              </text>
              <text x={x} y={142} textAnchor="middle" className="fill-muted-foreground font-mono text-[11px]">
                ≈ {step.time}
              </text>
            </g>
          );
        })}
      </svg>
      <ol className="grid gap-0 sm:hidden" aria-hidden="true">
        {JOURNEY.map((step, index) => {
          const last = index === JOURNEY.length - 1;
          return (
            <li key={step.title} className="relative flex gap-3 pb-4 last:pb-0">
              {!last && <span className="absolute top-9 bottom-0 left-[17px] w-0.5 bg-border" />}
              <span
                className={
                  last
                    ? "flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-foreground bg-foreground font-mono text-sm font-semibold text-background"
                    : "flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-foreground bg-background font-mono text-sm font-semibold"
                }
              >
                {index + 1}
              </span>
              <span className="pt-1">
                <span className="block font-heading text-[15px] font-bold">{step.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {step.detail} · ≈ {step.time}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function SignUpFigure() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <MockWindow url="extravertyai.com/sign-up">
        <MockHeading title="Créer votre compte" description="Votre nom et votre e-mail suffisent." />
        <div className="mt-5 grid gap-3">
          <div>
            <MockLabel pin={1}>Nom</MockLabel>
            <MockField>
              <User className="size-3.5 text-muted-foreground" />
              Awa Ndong
            </MockField>
          </div>
          <div>
            <MockLabel>E-mail</MockLabel>
            <MockField>
              <AtSign className="size-3.5 text-muted-foreground" />
              awa@exemple.com
            </MockField>
          </div>
          <MockButton className="h-9 w-full">Continuer</MockButton>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            ou
            <span className="h-px flex-1 bg-border" />
          </div>
          <MockButton variant="outline" className="h-9 w-full">
            Continuer avec Google
          </MockButton>
        </div>
      </MockWindow>
      <MockWindow url="extravertyai.com/sign-up">
        <MockHeading title="Vérifiez votre e-mail" description="Code à 6 chiffres envoyé à awa@exemple.com" />
        <div className="mt-5 grid gap-3">
          <div>
            <MockLabel pin={2}>Code de vérification</MockLabel>
            <MockField className="justify-center font-mono text-sm tracking-[0.4em]">482913</MockField>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Plus className="size-3" />
            Ajouter un mot de passe (facultatif)
          </span>
          <MockButton className="h-9 w-full">Créer mon compte</MockButton>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span className="underline underline-offset-2">Renvoyer le code</span>
            <span className="underline underline-offset-2">Modifier l’adresse</span>
          </div>
        </div>
      </MockWindow>
    </div>
  );
}

function ProjectFigure() {
  return (
    <MockWindow url="extravertyai.com/projects/new">
      <MockHeading title="Créer un projet" description="Votre entreprise sur WhatsApp, avec son assistant." />
      <div className="mt-5 grid gap-4">
        <div>
          <MockLabel pin={1}>Nom du projet (Entreprise)</MockLabel>
          <MockField>Boutique Akanda</MockField>
        </div>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div>
            <MockLabel pin={2}>Pays</MockLabel>
            <MockField>
              Gabon
              <ChevronDown className="ml-auto size-3.5 text-muted-foreground" />
            </MockField>
          </div>
          <div>
            <MockLabel>Numéro WhatsApp</MockLabel>
            <MockField className="px-0">
              <span className="flex h-full items-center border-r bg-muted/60 px-2.5 text-muted-foreground">+241</span>
              <span className="font-mono">74 12 34 56</span>
            </MockField>
          </div>
        </div>
        <div>
          <MockLabel pin={3}>Forfait</MockLabel>
          <div className="grid gap-2 sm:grid-cols-3">
            {PRICING_PLANS.map((plan) => (
              <MockOption
                key={plan.id}
                title={plan.name}
                hint={`${formatPlanPrice(plan.priceCents)} / mois`}
                selected={plan.highlighted}
              />
            ))}
          </div>
        </div>
        <div className="grid gap-3 border-t pt-4">
          <div className="flex items-baseline justify-between gap-4">
            <span className="flex items-center gap-2 text-xs font-medium">
              <Pin>4</Pin>
              À payer aujourd’hui
            </span>
            <span className="font-heading text-xl font-bold">{formatPlanPrice(0)}</span>
          </div>
          <MockButton className="h-9 w-full">
            Vérifier mon numéro
            <ArrowRight />
          </MockButton>
        </div>
      </div>
    </MockWindow>
  );
}

function CompanyFigure() {
  return (
    <MockWindow url="extravertyai.com/projects/…/setup">
      <MockStepper current={0} />
      <div className="mt-1">
        <MockHeading title="Votre entreprise" description="L’essentiel pour que votre assistant la présente avec justesse." />
      </div>
      <div className="mt-5 grid gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
            <ImagePlus className="size-4" />
          </span>
          <span className="text-xs text-muted-foreground">Logo (facultatif)</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <MockLabel>Nom de l’entreprise</MockLabel>
            <MockField>Boutique Akanda</MockField>
          </div>
          <div>
            <MockLabel>Secteur d’activité</MockLabel>
            <MockField>
              Commerce
              <ChevronDown className="ml-auto size-3.5 text-muted-foreground" />
            </MockField>
          </div>
        </div>
        <div>
          <MockLabel>Votre activité</MockLabel>
          <div className="rounded-md border bg-background p-3 text-xs leading-relaxed text-foreground">
            Prêt-à-porter femme et homme à Libreville, livraison dans tout le Gabon.
          </div>
        </div>
        <div className="flex justify-end">
          <MockButton>
            Continuer
            <ArrowRight />
          </MockButton>
        </div>
      </div>
    </MockWindow>
  );
}

function ProfileFigure() {
  return (
    <MockWindow url="extravertyai.com/projects/…/setup">
      <MockStepper current={2} />
      <div className="mt-1">
        <MockHeading title="Présentez votre assistant" description="Son nom et sa façon de parler à vos clients sur WhatsApp." />
      </div>
      <div className="mt-5 grid gap-4">
        <div>
          <MockLabel>Nom de votre agent</MockLabel>
          <MockField>Nova</MockField>
        </div>
        <div>
          <MockLabel>Ton de l’agent</MockLabel>
          <div className="grid gap-2 sm:grid-cols-3">
            <MockOption title="Chaleureux" hint="Accueillant, naturel et attentionné." selected />
            <MockOption title="Professionnel" hint="Précis, posé et courtois." />
            <MockOption title="Direct" hint="Va à l’essentiel, sans détour." />
          </div>
        </div>
        <div>
          <MockLabel>Longueur des réponses</MockLabel>
          <div className="grid gap-2 sm:grid-cols-3">
            <MockOption title="Concis" hint="Recommandé sur WhatsApp" selected />
            <MockOption title="Équilibré" hint="Réponses structurées" />
            <MockOption title="Détaillé" hint="Explications complètes" />
          </div>
        </div>
        <div className="flex justify-end">
          <MockButton>
            Continuer
            <ArrowRight />
          </MockButton>
        </div>
      </div>
    </MockWindow>
  );
}

const ACTORS = "fill-background stroke-border";

/** Circuit d’un message : client, assistant, connaissances, Instinct IA et équipe. */
function CircuitFigure() {
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <svg viewBox="0 0 760 312" className="w-full min-w-[640px]" aria-hidden="true">
        <defs>
          <marker id="help-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="fill-muted-foreground" />
          </marker>
        </defs>
        <g className="text-[12px]">
          <rect x="24" y="16" width="176" height="56" rx="12" strokeWidth={1.5} className={ACTORS} />
          <text x="40" y="40" className="fill-foreground font-heading text-[14px] font-bold">Votre équipe</text>
          <text x="40" y="58" className="fill-muted-foreground">dans la messagerie</text>
          <line x1="112" y1="72" x2="112" y2="118" strokeWidth={1.5} className="stroke-muted-foreground" markerEnd="url(#help-arrow)" />
          <text x="124" y="92" className="fill-muted-foreground">clique « Répondre » :</text>
          <text x="124" y="107" className="fill-muted-foreground">l’IA se retire</text>

          <rect x="24" y="124" width="176" height="64" rx="12" strokeWidth={1.5} className={ACTORS} />
          <text x="40" y="150" className="fill-foreground font-heading text-[14px] font-bold">Client</text>
          <text x="40" y="170" className="fill-muted-foreground">écrit sur WhatsApp</text>

          <line x1="200" y1="144" x2="298" y2="144" strokeWidth={1.5} className="stroke-muted-foreground" markerEnd="url(#help-arrow)" />
          <text x="249" y="136" textAnchor="middle" className="fill-muted-foreground">message</text>
          <line x1="302" y1="170" x2="204" y2="170" strokeWidth={1.5} className="stroke-muted-foreground" markerEnd="url(#help-arrow)" />
          <text x="253" y="186" textAnchor="middle" className="fill-muted-foreground">réponse</text>

          <rect x="302" y="124" width="180" height="64" rx="12" className="fill-foreground" />
          <text x="318" y="150" className="fill-background font-heading text-[14px] font-bold">Assistant IA</text>
          <text x="318" y="170" className="fill-background/75">répond 24 h/24</text>

          <rect x="302" y="240" width="180" height="56" rx="12" strokeWidth={1.5} className={ACTORS} />
          <text x="318" y="264" className="fill-foreground font-heading text-[14px] font-bold">Connaissances</text>
          <text x="318" y="282" className="fill-muted-foreground">infos, produits, PDF</text>
          <line x1="392" y1="240" x2="392" y2="194" strokeWidth={1.5} strokeDasharray="4 4" className="stroke-muted-foreground" markerEnd="url(#help-arrow)" />
          <text x="402" y="222" className="fill-muted-foreground">s’appuie sur</text>

          <line x1="482" y1="156" x2="572" y2="156" strokeWidth={1.5} className="stroke-muted-foreground" markerEnd="url(#help-arrow)" />
          <text x="576" y="112" className="fill-muted-foreground">Pro et Business</text>
          <rect x="576" y="124" width="160" height="64" rx="12" strokeWidth={1.5} className={ACTORS} />
          <text x="592" y="150" className="fill-foreground font-heading text-[14px] font-bold">Instinct IA</text>
          <text x="592" y="170" className="fill-muted-foreground">classe le contact</text>
          <line x1="656" y1="188" x2="656" y2="204" strokeWidth={1.5} className="stroke-border" />
          {["Intéressant", "À relancer", "Aucun"].map((label, index) => (
            <g key={label}>
              <rect
                x="576"
                y={204 + index * 30}
                width="160"
                height="24"
                rx="12"
                strokeWidth={1}
                className={index === 0 ? "fill-foreground stroke-foreground" : index === 1 ? "fill-muted stroke-foreground" : "fill-background stroke-border"}
              />
              <text
                x="656"
                y={220 + index * 30}
                textAnchor="middle"
                className={index === 0 ? "fill-background text-[11px] font-semibold" : "fill-foreground text-[11px] font-semibold"}
              >
                {label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

/** Les figures statiques sont masquées aux lecteurs d’écran, qui lisent leur description. */
function Decorative({ children }: { children: React.ReactNode }) {
  return <div aria-hidden="true">{children}</div>;
}

export function HelpFigureView({ figure }: { figure: HelpFigureId }) {
  switch (figure) {
    case "parcours":
      return (
        <Decorative>
          <JourneyFigure />
        </Decorative>
      );
    case "inscription":
      return (
        <Decorative>
          <SignUpFigure />
        </Decorative>
      );
    case "projet":
      return (
        <Decorative>
          <ProjectFigure />
        </Decorative>
      );
    case "entreprise":
      return (
        <Decorative>
          <CompanyFigure />
        </Decorative>
      );
    case "profil":
      return (
        <Decorative>
          <ProfileFigure />
        </Decorative>
      );
    case "circuit":
      return (
        <Decorative>
          <CircuitFigure />
        </Decorative>
      );
    case "verification":
      return <VerificationFigure />;
    case "test":
      return <TestChatFigure />;
    case "connexion":
      return <ConnectionFigure />;
  }
}
