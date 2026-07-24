import Footer from "@/components/website/footer";
import { Header } from "@/components/website/header";
import { DecorIcon } from "@/components/ui/decor-icon"
import { FullWidthDivider } from "@/components/ui/full-width-divider"
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "ExtravertyAI - A propos",
    description:
        "ExtravertyAI est un assistant de support client alimenté par l'IA qui fournit des réponses rapides et précises aux questions des clients, améliorant ainsi l'expérience client et le nombre de ventes.",
};

const Listes = [
    "Assurer une prise en charge instantanée des requêtes clients.",
    "Traiter de manière autonome les questions fréquentes(FAQ).",
    "Qualifier rigoureusement les prospects entrants.",
    "Accompagner et fluidifier le parcours d’achat.",
    "Collecter et structurer les données clients essentielles.",
    "Automatiser l’ensemble du support client de premier niveau."
]
export const dynamic = "force-static";

function Apropos() {
    return (
        <>
            <Header />
            <main className='relative h-full overflow-hidden'>

                <div className='relative w-full max-w-7xl border-x pt-26 mx-auto '>
                    <DecorIcon className="size-4" position="top-left" />
                    <DecorIcon className="size-4" position="top-right" />
                    <DecorIcon className="size-4" position="bottom-left" />
                    <DecorIcon className="size-4" position="bottom-right" />

                    <FullWidthDivider className="-top-px" />
                    <div className="w-full max-w-5xl md:mx-auto space-y-16 py-12 px-4 md:px-6">
                        {/* --- SECTION 1 : PRÉSENTATION & MISSION --- */}
                        <section className="flex flex-col gap-6">
                            <div className="space-y-2">
                                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                                    PRÉSENTATION & MISSION
                                </h2>
                                <div className="h-1 w-12 bg-primary rounded-full"></div>
                            </div>

                            <div className="max-w-3xl space-y-4 text-base md:text-lg text-muted-foreground leading-relaxed">
                                <p>
                                    ExtravertyAI est une <span className="font-semibold text-foreground">agence technologique</span> spécialisée dans l&apos;<span className="font-semibold text-foreground">intégration de solutions d&apos;automatisation intelligente sur WhatsApp</span> à destination des entreprises.
                                </p>
                                <p>
                                    Notre mission consiste à accompagner les organisations dans <span className="font-semibold text-foreground">l&apos;optimisation de leur réactivité commerciale</span>, l&apos;accroissement de leurs ventes et la rationalisation de leur gestion client, en garantissant <span className="font-semibold text-foreground">une disponibilité opérationnelle continue, 24h/24 et 7j/7.</span>
                                </p>
                                <p>
                                    De manière concrète, nous déployons un <span className="font-semibold text-foreground">assistant virtuel</span> doté d&apos;intelligence artificielle capable de :
                                </p>
                            </div>

                            {/* Transformation de la liste en grille pour une meilleure lisibilité */}
                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                {Listes.map((item, index) => (
                                    <li key={index} className="flex items-start gap-3 text-sm md:text-base text-muted-foreground bg-muted/30 p-3 rounded-lg">
                                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-foreground shrink-0"></span>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        {/* --- SECTION 2 : FLEXIBILITÉ & OFFRES --- */}
                        <section className="flex flex-col gap-6">
                            <div className="space-y-2">
                                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                                    FLEXIBILITÉ & OFFRES
                                </h2>
                                <div className="h-1 w-12 bg-primary rounded-full"></div>
                            </div>

                            <p className="max-w-3xl text-base md:text-lg text-muted-foreground leading-relaxed">
                                Nos solutions sur mesure s&apos;adaptent précisément aux exigences de divers secteurs d&apos;activité : <span className="font-semibold text-foreground">commerce de détail, e-commerce, restauration, prestations de services, coaching ou encore immobilier.</span> Pour répondre aux objectifs stratégiques de chaque structure, nous proposons trois niveaux d&apos;accompagnement :
                            </p>

                            {/* Mise en valeur des offres sous forme de cartes */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                                <div className="flex flex-col p-6 rounded-xl border bg-background text-card-foreground shadow-sm transition-all hover:shadow-md">
                                    <h3 className="font-bold text-lg mb-2">STARTER</h3>
                                    <p className="text-sm text-muted-foreground">Conçu pour initier sereinement la transition vers l&apos;automatisation.</p>
                                </div>
                                <div className="flex flex-col p-6 rounded-xl border border-primary/20 bg-card text-card-foreground shadow-sm transition-all hover:shadow-md relative overflow-hidden">
                                    <h3 className="font-bold text-lg mb-2 text-primary">PRO</h3>
                                    <p className="text-sm text-muted-foreground">Développé pour accélérer la performance commerciale et optimiser les volumes de ventes.</p>
                                </div>
                                <div className="flex flex-col p-6 rounded-xl border bg-background text-card-foreground shadow-sm transition-all hover:shadow-md">
                                    <h3 className="font-bold text-lg mb-2">BUSINESS</h3>
                                    <p className="text-sm text-muted-foreground">Une infrastructure d&apos;automatisation avancée, complète et interconnectée.</p>
                                </div>
                            </div>

                            <div className="p-4 mt-2 bg-muted rounded-lg border-l-4 border-foreground">
                                <p className="text-sm md:text-base font-medium text-foreground">
                                    L&apos;objectif fondamental est de transformer WhatsApp en un canal stratégique de vente et de support, performant, structuré et entièrement automatisé.
                                </p>
                            </div>
                        </section>

                        {/* --- SECTION 3 : PROCESSUS OPÉRATIONNEL --- */}
                        <section className="flex flex-col gap-8">

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                                        PROCESSUS OPÉRATIONNEL
                                    </h2>
                                    <div className="h-1 w-12 bg-primary rounded-full"></div>
                                </div>
                                <p className="text-base md:text-lg text-muted-foreground">
                                    Le déploiement de notre solution s&apos;articule autour d&apos;un parcours d&apos;intégration fluide :
                                </p>
                            </div>

                            {/* Amélioration visuelle des étapes du processus */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <ol className="space-y-6 relative border-l border-muted-foreground/20 ml-3 md:ml-0 md:border-none">
                                    {[
                                        { title: "Connexion", desc: "Liaison sécurisée du compte WhatsApp de l’entreprise à notre infrastructure." },
                                        { title: "Configuration", desc: "Paramétrage de l’assistant IA et modélisation des connaissances selon la spécificité de votre activité." },
                                        { title: "Test et validation", desc: "Mise à disposition du système dans un environnement de test sécurisé pour validation des scénarios." },
                                        { title: "Déploiement", desc: "Prise en charge immédiate, automatisée et intelligente des flux de prospects et de clients." }
                                    ].map((step, index) => (
                                        <li key={index} className="relative pl-6 md:pl-0">
                                            {/* Point indicateur pour mobile / Numéro pour Desktop */}
                                            <span className="absolute -left-1.25 top-1.5 h-2.5 w-2.5 rounded-full bg-foreground md:static md:inline-flex md:h-8 md:w-8 md:items-center md:justify-center md:bg-muted md:text-foreground md:font-bold md:mr-3">
                                                <span className="hidden md:block">{index + 1}</span>
                                            </span>
                                            <span className="text-foreground font-semibold text-base">{step.title} : </span>
                                            <span className="text-muted-foreground text-sm md:text-base">{step.desc}</span>
                                        </li>
                                    ))}
                                </ol>

                                <div className="bg-card border rounded-xl p-6 shadow-sm">
                                    <h3 className="text-lg font-semibold mb-4 border-b pb-2">Champs de compétences :</h3>
                                    <ul className="space-y-3">
                                        {[
                                            "Analyse et réponse précise aux sollicitations.",
                                            "Évaluation et segmentation des prospects.",
                                            "Conduite naturelle vers l'acte d'achat.",
                                            "Gestion autonome des rendez-vous.",
                                            "Centralisation des informations stratégiques.",
                                            "Passation fluide vers un conseiller humain si nécessaire."
                                        ].map((skill, idx) => (
                                            <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                                                <svg className="w-4 h-4 text-foreground mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                <span>{skill}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </section>

                        {/* --- SECTION 4 : TECHNOLOGIE & INNOVATION --- */}
                        <section className="flex flex-col gap-4 py-8">
                            <div className="space-y-2">
                                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                                    TECHNOLOGIE & INNOVATION
                                </h2>
                                <div className="h-1 w-12 bg-primary rounded-full"></div>
                            </div>

                            <p className="max-w-3xl text-base md:text-lg text-muted-foreground leading-relaxed">
                                Nous exploitons le plein potentiel des derniers modèles de langage (LLM) les plus performants du marché. Cette expertise de pointe garantit des interactions d&apos;une grande fluidité, contextuelles et d&apos;un niveau de qualité optimal.
                            </p>
                        </section>
                    </div>
                    <FullWidthDivider className="-bottom-px" />
                    <Footer />

                </div>
            </main>
        </>

    )
}

export default Apropos