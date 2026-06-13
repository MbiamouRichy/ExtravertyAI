import React from 'react';
import { ShieldCheck, Lock, Database, Mail, Cog, Share2, Scale } from 'lucide-react';
import type { Metadata } from "next";
import { Header } from '@/components/header';
import Footer from '@/components/footer';
import { WhatsAppIcon } from '@/components/social-icon';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
    title: "ExtravertyAI - Politique de Confidentialité",
};
export const dynamic = "force-static";
export default function PrivacyPolicy() {
    const lastUpdated = "12 Juin 2026";

    const sections = [
        { id: "collecte", title: "1. Données collectées" },
        { id: "utilisation", title: "2. Utilisation des données" },
        { id: "partage", title: "3. Partage et Tiers" },
        { id: "securite", title: "4. Sécurité" },
        { id: "droits", title: "5. Vos droits" },
        { id: "contact", title: "6. Contact" },
    ];

    return (
        <>
            <Header />

            <div className="min-h-screen overflow-x-hidden w-full bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground">

                {/* Header Section */}
                <section className="bg-muted/40 border-b border-border py-16 sm:py-24">
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center gap-3 text-muted-foreground mb-4">
                            <ShieldCheck className="w-6 h-6 text-foreground" />
                            <span className="text-sm font-semibold tracking-wider uppercase">Légal</span>
                        </div>
                        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground mb-4">
                            Politique de Confidentialité
                        </h1>
                        <p className="text-lg text-muted-foreground max-w-2xl">
                            Chez ExtravertyAI, nous prenons la protection de vos données et celles de vos clients très au sérieux. Découvrez comment nous gérons vos informations en toute transparence.
                        </p>
                        <div className="mt-6 text-sm text-muted-foreground font-medium">
                            Dernière mise à jour : {lastUpdated}
                        </div>
                    </div>
                </section>

                {/* Main Content */}
                <div className={cn('relative max-w-7xl md:mx-auto w-full h-full grow',
                    // X BORDER
                    "before:absolute before:-inset-y-14 before:-left-px before:w-px before:bg-border",
                    "after:absolute after:-inset-y-14 after:-right-px after:w-px after:bg-border",
                )}>
                    <div className="max-w-5xl md:mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 flex flex-col md:flex-row gap-12 lg:gap-24">
                        {/* Sidebar Navigation (Sticky) */}
                        <aside className="md:w-1/4 sticky top-24 hidden md:block self-start">
                            <div className="w-full">
                                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
                                    Sommaire
                                </h3>
                                <nav className="flex flex-col gap-3">
                                    {sections.map((section) => (
                                        <a
                                            key={section.id}
                                            href={`#${section.id}`}
                                            className="text-sm text-muted-foreground hover:text-foreground hover:translate-x-1 transition-all duration-200 font-medium"
                                        >
                                            {section.title}
                                        </a>
                                    ))}
                                </nav>
                            </div>
                        </aside>

                        {/* Policy Content */}
                        <div className="md:w-3/4 max-w-none">

                            <section id="collecte" className="mb-12 scroll-mt-24">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2 bg-secondary rounded-lg">
                                        <Database className="w-5 h-5 text-secondary-foreground" />
                                    </div>
                                    <h2 className="text-2xl font-bold m-0 text-foreground">1. Données collectées</h2>
                                </div>
                                <p className="text-muted-foreground leading-relaxed">
                                    Dans le cadre de l&apos;utilisation de nos services d&apos;automatisation, nous collectons différents types d&apos;informations :
                                </p>
                                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-4 marker:text-muted-foreground/50">
                                    <li><strong className="text-foreground">Informations de compte :</strong> Nom, adresse email, informations de facturation de votre entreprise.</li>
                                    <li><strong className="text-foreground">Données d&apos;intégration :</strong> Numéros WhatsApp professionnels pour la configurations de webhook nécessaires au fonctionnement de nos agents.</li>
                                    <li><strong className="text-foreground">Données de traitement :</strong> Les flux de messages traités par nos systèmes d&apos;intelligence artificielle pour le compte de votre support client.</li>
                                </ul>
                            </section>

                            <hr className="border-border my-10" />

                            <section id="utilisation" className="mb-12 scroll-mt-24">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2 bg-secondary rounded-lg">
                                        <Cog className="w-5 h-5 text-secondary-foreground" />
                                    </div>
                                    <h2 className="text-2xl font-bold m-0 text-foreground">2. Utilisation des données</h2>
                                </div>
                                <p className="text-muted-foreground leading-relaxed mb-4">
                                    Nous utilisons vos données exclusivement pour :
                                </p>
                                <ul className="list-disc pl-6 text-muted-foreground space-y-2 marker:text-muted-foreground/50">
                                    <li>Fournir, opérer et maintenir nos services d&apos;agents IA.</li>
                                    <li>Améliorer la logique de nos systèmes et la précision des réponses automatisées.</li>
                                    <li>Assurer le support technique et répondre à vos demandes.</li>
                                    <li>Traiter les transactions via nos prestataires de paiement sécurisés.</li>
                                </ul>
                            </section>

                            <hr className="border-border my-10" />

                            <section id="partage" className="mb-12 scroll-mt-24">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2 bg-secondary rounded-lg">
                                        <Share2 className="w-5 h-5 text-secondary-foreground" />
                                    </div>
                                    <h2 className="text-2xl font-bold m-0 text-foreground">3. Partage et Tiers</h2>
                                </div>
                                <p className="text-muted-foreground leading-relaxed">
                                    ExtravertyAI ne vend <strong className="text-foreground">jamais </strong> vos données personnelles ni celles de vos clients. Nous partageons certaines informations uniquement avec des fournisseurs d&apos;infrastructure cloud de confiance (hébergement, bases de données, modèles de langage) strictement nécessaires à l&apos;exécution de notre service, dans le cadre d&apos;accords de confidentialité rigoureux.
                                </p>
                            </section>

                            <hr className="border-border my-10" />

                            <section id="securite" className="mb-12 scroll-mt-24">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2 bg-secondary rounded-lg">
                                        <Lock className="w-5 h-5 text-secondary-foreground" />
                                    </div>
                                    <h2 className="text-2xl font-bold m-0 text-foreground">4. Sécurité</h2>
                                </div>
                                <p className="text-muted-foreground leading-relaxed">
                                    Nous mettons en œuvre des mesures de sécurité de niveau entreprise pour protéger vos informations. Les données en transit sont chiffrées via TLS/SSL, et les données au repos sont stockées dans des bases de données sécurisées avec des accès strictement contrôlés et authentifiés.
                                </p>
                            </section>

                            <hr className="border-border my-10" />

                            <section id="droits" className="mb-12 scroll-mt-24">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2 bg-secondary rounded-lg">
                                        <Scale className="w-5 h-5 text-secondary-foreground" />
                                    </div>
                                    <h2 className="text-2xl font-bold m-0 text-foreground">5. Vos droits</h2>
                                </div>
                                <p className="text-muted-foreground leading-relaxed">
                                    Vous conservez le contrôle total sur vos données. Vous avez le droit de demander l&apos;accès, la rectification, la portabilité ou la suppression complète de vos données de nos serveurs à tout moment. La suppression d&apos;un compte entraîne la purge de toutes les données associées de notre base de données principale.
                                </p>
                            </section>

                            <hr className="border-border my-10" />

                            <section id="contact" className="mb-12 scroll-mt-24 dark:bg-card bg-primary/5 text-card-foreground p-8 rounded-2xl border border-border shadow-sm">
                                <div className="flex items-center gap-3 mb-4">
                                    <Mail className="w-6 h-6 text-foreground" />
                                    <h2 className="text-xl font-bold m-0 text-foreground">6. Nous contacter</h2>
                                </div>
                                <p className="text-muted-foreground leading-relaxed mb-6">
                                    Pour toute question concernant cette politique de confidentialité ou pour exercer vos droits, notre équipe est à votre disposition.
                                </p>
                                <a
                                    target="_blank"
                                    href="https://wa.me/24176205629?text=Bonjour,%20j'ai%20une%20question%20concernant%20la%20politique%20de%20confidentialité%20d'ExtravertyAI."
                                    className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 transition-colors shadow-sm"
                                >
                                    <WhatsAppIcon className="mr-2 size-6 hidden md:block" data-icon="inline-start" />  Discuter avec notre équipe
                                </a>
                            </section>

                        </div>
                    </div>
                </div>
                <Footer />

            </div>
        </>

    );
}