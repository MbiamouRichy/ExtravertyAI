"use client";

import { useState } from "react";
import {
    Send, Bot, User as UserIcon, Search,
    Phone, CheckCheck, MoreVertical, ShieldAlert, Sparkles, ArrowLeft, MessageCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
    MessageScrollerProvider,
    MessageScroller,
    MessageScrollerViewport,
    MessageScrollerContent,
    MessageScrollerItem,
    MessageScrollerButton,
} from "@/components/ui/message-scroller";
import {
    MessageGroup,
    Message,
    MessageAvatar,
    MessageContent,
    MessageHeader,
    MessageFooter,
} from "@/components/ui/message";

// --- TYPES ---
type Project = { id: string; name: string };
type User = { id: string; name?: string | null; image?: string | null };

type ChatClient = {
    id: string;
    name: string;
    phone: string;
    lastMessage: string;
    timestamp: string;
    unread: number;
    aiActive: boolean;
};

type ChatMessage = {
    id: string;
    senderType: "client" | "bot" | "agent";
    content: string;
    timestamp: Date;
    status: "sent" | "delivered" | "read";
};

// --- MOCK DATA : SCÉNARIO DE 25 MESSAGES ---
const generateConversation = (): ChatMessage[] => {
    const baseTime = new Date();
    baseTime.setHours(10, 0, 0, 0); // Début à 10h00

    const addMin = (mins: number) => new Date(baseTime.getTime() + mins * 60000);

    return [
        { id: "1", senderType: "client", content: "Bonjour, je cherche une solution pour mon service client.", timestamp: addMin(0), status: "read" },
        { id: "2", senderType: "bot", content: "Bonjour Marc ! Bienvenue chez ExtravertyAI. 👋 Je suis l'assistant virtuel. Que recherchez-vous exactement ?", timestamp: addMin(1), status: "read" },
        { id: "3", senderType: "client", content: "J'ai une agence immobilière et je reçois trop de messages WhatsApp pour des demandes de visites.", timestamp: addMin(3), status: "read" },
        { id: "4", senderType: "client", content: "Je n'arrive plus à suivre.", timestamp: addMin(3), status: "read" },
        { id: "5", senderType: "bot", content: "C'est un cas d'usage parfait pour notre IA ! Nous pouvons automatiser la qualification des prospects, vérifier leurs critères (budget, localisation) et même planifier les visites automatiquement.", timestamp: addMin(4), status: "read" },
        { id: "6", senderType: "client", content: "Ah super. Comment ça marche concrètement ?", timestamp: addMin(6), status: "read" },
        { id: "7", senderType: "bot", content: "Vous connectez simplement votre numéro WhatsApp à notre plateforme. L'IA s'occupe de répondre en fonction de vos directives 24h/24 et 7j/7. Vous pouvez reprendre la main à tout moment depuis ce tableau de bord.", timestamp: addMin(7), status: "read" },
        { id: "8", senderType: "client", content: "Et si le client pose une question trop complexe ?", timestamp: addMin(10), status: "read" },
        { id: "9", senderType: "bot", content: "Excellente question. Si l'IA ne connaît pas la réponse, elle met la conversation en pause et vous notifie. Un agent humain peut alors intervenir.", timestamp: addMin(11), status: "read" },
        { id: "10", senderType: "client", content: "Génial. Vous avez une intégration avec HubSpot ?", timestamp: addMin(15), status: "read" },
        { id: "11", senderType: "bot", content: "Oui, nous avons une intégration native HubSpot. Les contacts et les historiques de chat y sont synchronisés en temps réel.", timestamp: addMin(15), status: "read" },
        { id: "12", senderType: "client", content: "Quel est le prix pour environ 1000 conversations par mois ?", timestamp: addMin(20), status: "read" },
        { id: "13", senderType: "bot", content: "Pour 1000 conversations, notre plan Pro à 99€/mois est le plus adapté. Souhaitez-vous démarrer un essai gratuit de 14 jours ?", timestamp: addMin(21), status: "read" },
        { id: "14", senderType: "client", content: "Oui, comment je fais ?", timestamp: addMin(25), status: "read" },
        { id: "15", senderType: "bot", content: "Super ! Cliquez sur ce lien pour créer votre compte : https://extraverty.ai/register", timestamp: addMin(25), status: "read" },
        { id: "16", senderType: "client", content: "Le lien m'affiche une erreur 404.", timestamp: addMin(28), status: "read" },
        { id: "17", senderType: "bot", content: "Je suis désolé pour ce désagrément. Pouvez-vous essayer depuis un ordinateur ou rafraîchir la page ?", timestamp: addMin(29), status: "read" },
        { id: "18", senderType: "client", content: "Toujours pareil, ça bloque à l'étape du paiement Stripe.", timestamp: addMin(32), status: "read" },
        { id: "19", senderType: "bot", content: "Je comprends. Je mets l'IA en pause et je transfère votre demande à un membre de notre équipe technique. Un instant svp.", timestamp: addMin(33), status: "read" },
        { id: "20", senderType: "agent", content: "Bonjour Marc, je suis Richy, le support technique. Je vois que vous rencontrez un souci avec le lien de paiement.", timestamp: addMin(40), status: "read" },
        { id: "21", senderType: "client", content: "Bonjour Richy, oui ça tourne dans le vide après avoir validé ma carte.", timestamp: addMin(41), status: "read" },
        { id: "22", senderType: "agent", content: "Je viens de vérifier nos logs. Il y a eu un micro-coupure avec notre fournisseur Stripe. Je viens de générer un lien de paiement direct et sécurisé pour vous.", timestamp: addMin(43), status: "read" },
        { id: "23", senderType: "agent", content: "Voici le lien direct : https://buy.stripe.com/test_123456", timestamp: addMin(43), status: "delivered" },
        { id: "24", senderType: "client", content: "Merci, je teste ça tout de suite.", timestamp: addMin(45), status: "delivered" },
        { id: "25", senderType: "client", content: "C'est bon, le paiement est passé ! Mon numéro WhatsApp est en train de se connecter.", timestamp: addMin(48), status: "delivered" }
    ];
};

const MOCK_CLIENTS: ChatClient[] = [
    { id: "c1", name: "Marc Dubois", phone: "+33 6 12 34 56 78", lastMessage: "C'est bon, le paiement est passé !", timestamp: "10:48", unread: 2, aiActive: false },
    { id: "c2", name: "Sophie Martin", phone: "+33 7 89 01 23 45", lastMessage: "Merci pour l'information.", timestamp: "09:15", unread: 0, aiActive: true },
    { id: "c3", name: "+241 07 12 34 56", phone: "+241 07 12 34 56", lastMessage: "Je voudrais prendre RDV", timestamp: "Hier", unread: 0, aiActive: true },
];

const MOCK_MESSAGES: Record<string, ChatMessage[]> = {
    "c1": generateConversation(),
    "c2": [], // Vidé pour l'exemple
    "c3": []
};

export default function WhatsappWorkspace({ project, user }: { project: Project; user: User }) {
    const [clients] = useState<ChatClient[]>(MOCK_CLIENTS);
    const [activeClientId, setActiveClientId] = useState<string | null>(clients[0].id);
    const [messages, setMessages] = useState<ChatMessage[]>(MOCK_MESSAGES[clients[0].id] || []);
    const [input, setInput] = useState("");
    const [isSending, setIsSending] = useState(false);

    // 📱 ÉTAT RESPONSIVE : Définit si on affiche le chat sur mobile
    const [showMobileChat, setShowMobileChat] = useState<boolean>(false);

    const activeClient = clients.find(c => c.id === activeClientId);

    const handleSelectClient = (clientId: string) => {
        setActiveClientId(clientId);
        setMessages(MOCK_MESSAGES[clientId] || []);
        setShowMobileChat(true); // Bascule sur la vue chat en mobile
    };

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isSending) return;

        const newMessage: ChatMessage = {
            id: Date.now().toString(),
            senderType: "agent",
            content: input,
            timestamp: new Date(),
            status: "sent"
        };

        setMessages((prev) => [...prev, newMessage]);
        setInput("");
        setIsSending(true);

        // Simulation API
        setTimeout(() => setIsSending(false), 500);
    };

    return (
        <div className="flex w-full h-[calc(100vh-4rem)] md:overflow-hidden bg-background border-t relative">

            {/* -------------------------------------------------------------------------
          SIDEBAR (Liste des clients)
          > Cachée sur mobile si un chat est ouvert (showMobileChat === true)
      -------------------------------------------------------------------------- */}
            <div className={`w-full md:w-80 lg:w-96 md:border-r flex-col bg-muted/10 shrink-0 h-full ${showMobileChat ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b bg-background/50 backdrop-blur-sm">
                    <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                        Boîte de réception
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
                            {project.name}
                        </Badge>
                    </h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Rechercher..."
                            className="pl-9 bg-background shadow-sm rounded-xl h-10"
                        />
                    </div>
                </div>

                <ScrollArea className="flex-1 h-full">
                    <div className="flex flex-col w-full">
                        {clients.map((client) => (
                            <button
                                key={client.id}
                                onClick={() => handleSelectClient(client.id)}
                                className={`flex items-start gap-3 p-4 text-left w-full transition-colors border-b last:border-0 ${activeClientId === client.id
                                    ? "bg-primary/5 border-l-2 border-l-primary"
                                    : "hover:bg-muted/50 border-l-2 border-l-transparent"
                                    }`}
                            >
                                <div className="relative">
                                    <Avatar className="h-12 w-12 border">
                                        <AvatarFallback className="bg-muted text-muted-foreground font-medium">
                                            {client.name.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    {client.aiActive && (
                                        <span className="absolute -bottom-1 -right-1 bg-blue-500 text-white rounded-full p-0.5 shadow-sm border-2 border-background">
                                            <Sparkles className="h-3 w-3" />
                                        </span>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <span className="font-semibold text-sm truncate">{client.name}</span>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">{client.timestamp}</span>
                                    </div>
                                    <div className="flex justify-between items-center gap-2">
                                        <p className="text-sm text-muted-foreground truncate line-clamp-1">
                                            {client.lastMessage}
                                        </p>
                                        {client.unread > 0 && (
                                            <Badge className="bg-emerald-500 text-white px-1.5 min-w-[20px] flex justify-center rounded-full">
                                                {client.unread}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* -------------------------------------------------------------------------
          MAIN AREA (Fenêtre de Chat)
          > Cachée sur mobile si aucun chat n'est actif
      -------------------------------------------------------------------------- */}
            <div className={`flex-1 flex-col bg-background/95 relative h-full ${!showMobileChat ? 'hidden md:flex' : 'flex'}`}>

                {activeClient ? (
                    <>
                        {/* HEADER CHAT */}
                        <header className="flex items-center justify-between px-3 md:px-6 py-3 md:py-4 border-b bg-background/60 backdrop-blur-md sticky top-0 z-20">
                            <div className="flex items-center gap-2 md:gap-4">

                                {/* 📱 BOUTON RETOUR MOBILE */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="md:hidden mr-1 shrink-0"
                                    onClick={() => setShowMobileChat(false)}
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>

                                <Avatar className="h-10 w-10 border shadow-sm shrink-0">
                                    <AvatarFallback>{activeClient.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                    <h2 className="text-base font-semibold tracking-tight truncate">{activeClient.name}</h2>
                                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                        <Phone className="h-3 w-3 shrink-0" />
                                        <span className="truncate">{activeClient.phone}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 md:gap-3 shrink-0">
                                <Badge variant={activeClient.aiActive ? "default" : "secondary"} className="gap-1.5 px-2 py-1 text-[10px] md:text-xs">
                                    {activeClient.aiActive ? <Bot className="h-3.5 w-3.5" /> : <UserIcon className="h-3.5 w-3.5" />}
                                    <span className="hidden sm:inline">{activeClient.aiActive ? "Géré par l'IA" : "Agent Actif"}</span>
                                </Badge>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </div>
                        </header>

                        {/* ZONE DE SCROLL DES MESSAGES */}
                        <MessageScrollerProvider>
                            <MessageScroller className="flex-1 bg-muted/30 dark:bg-background">
                                <MessageScrollerViewport className="px-3 md:px-6 py-6">
                                    <MessageScrollerContent className="max-w-4xl mx-auto">

                                        <MessageGroup>
                                            {messages.map((msg, index) => (
                                                <MessageScrollerItem key={msg.id} scrollAnchor={index === messages.length - 1}>

                                                    <Message align={msg.senderType === "client" ? "start" : "end"} className="mb-6">

                                                        <MessageAvatar
                                                            className={
                                                                msg.senderType === "client" ? "bg-background border hidden sm:flex" :
                                                                    msg.senderType === "bot" ? "bg-blue-100 text-blue-600 border-blue-200 hidden sm:flex" :
                                                                        "bg-transparent hidden sm:flex" // <-- Modification ici pour éviter le double fond avec l'Avatar
                                                            }
                                                        >
                                                            {msg.senderType === "client" ? (
                                                                <UserIcon className="size-5 rounded-full" />
                                                            ) : msg.senderType === "bot" ? (
                                                                <Sparkles className="size-4 rounded-full" />
                                                            ) : (
                                                                <Avatar className="h-8 w-8 border">
                                                                    <AvatarImage src={user?.image || ""} />
                                                                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                                                        {user?.name ? user.name.substring(0, 2).toUpperCase() : "MOI"}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                            )}
                                                        </MessageAvatar>

                                                        <MessageContent className={msg.senderType === "client" ? "items-start" : "items-end"}>
                                                            <MessageHeader className="hidden sm:flex">
                                                                {msg.senderType === "client" ? activeClient.name :
                                                                    msg.senderType === "bot" ? "ExtravertyAI" :
                                                                        (user?.name || "Vous")}
                                                            </MessageHeader>

                                                            <div
                                                                className={`px-4 py-2.5 max-w-[90%] sm:max-w-[80%] text-[15px] leading-relaxed shadow-sm transition-all ${msg.senderType === "client"
                                                                    ? "bg-card border border-border/50 text-foreground rounded-2xl rounded-tl-sm"
                                                                    : msg.senderType === "bot"
                                                                        ? "bg-blue-50/80 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 text-foreground rounded-2xl rounded-tr-sm"
                                                                        : "bg-[#00a884] dark:bg-[#008f6f] text-white rounded-2xl rounded-tr-sm"
                                                                    }`}
                                                            >
                                                                {msg.content}
                                                            </div>

                                                            <MessageFooter className="gap-1 mt-0.5 text-[10px] md:text-xs text-muted-foreground/80">
                                                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                {msg.senderType !== "client" && (
                                                                    <CheckCheck className={`h-3.5 w-3.5 ${msg.status === "read" ? "text-blue-500" : "text-muted-foreground"}`} />
                                                                )}
                                                            </MessageFooter>
                                                        </MessageContent>

                                                    </Message>
                                                </MessageScrollerItem>
                                            ))}
                                        </MessageGroup>

                                    </MessageScrollerContent>
                                </MessageScrollerViewport>

                                <MessageScrollerButton direction="end" />
                            </MessageScroller>
                        </MessageScrollerProvider>

                        {/* ZONE DE SAISIE */}
                        <div className="p-3 md:p-4 bg-background/80 backdrop-blur-md border-t pb-safe">
                            {activeClient.aiActive && (
                                <div className="max-w-4xl mx-auto mb-2 md:mb-3 flex items-start md:items-center justify-center gap-2 text-[11px] md:text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/30 py-2 px-3 md:px-4 rounded-lg text-center">
                                    <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 md:mt-0" />
                                    <span>Si vous envoyez un message, l&apos;IA sera automatiquement mise en pause.</span>
                                </div>
                            )}
                            <div className="max-w-4xl mx-auto relative">
                                <form
                                    onSubmit={handleSend}
                                    className="w-full relative flex items-center bg-muted/40 border rounded-full md:rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-[#00a884]/20 focus-within:border-[#00a884]/50 transition-all shadow-sm"
                                >
                                    <Input
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder="Message..."
                                        className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-4 md:px-5 py-5 md:py-6 text-sm md:text-base w-full shadow-none"
                                        disabled={isSending}
                                    />
                                    <Button
                                        type="submit"
                                        size="icon"
                                        disabled={!input.trim() || isSending}
                                        className={`absolute right-1.5 md:right-2 rounded-full md:rounded-xl h-9 w-9 md:h-10 md:w-10 transition-all ${input.trim()
                                            ? "bg-[#00a884] text-white hover:bg-[#008f6f] shadow-md"
                                            : "bg-muted text-muted-foreground hover:bg-muted"
                                            }`}
                                    >
                                        <Send className="h-4 w-4 ml-0.5 md:ml-1" />
                                        <span className="sr-only">Envoyer sur WhatsApp</span>
                                    </Button>
                                </form>
                            </div>
                        </div>

                    </>
                ) : (
                    // ÉTAT VIDE (Sur Desktop uniquement, si aucun client n'est sélectionné)
                    <div className="flex-1 flex flex-col items-center justify-center bg-muted/5 p-6 text-center h-full">
                        <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mb-6">
                            <MessageCircle className="h-10 w-10 text-muted-foreground/50" />
                        </div>
                        <h2 className="text-xl font-semibold mb-2">Boîte de réception ExtravertyAI</h2>
                        <p className="text-muted-foreground text-sm max-w-sm">
                            Sélectionnez une conversation dans la liste pour lire l&paos;historique ou reprendre la main sur l&apos;IA.
                        </p>
                    </div>
                )}
            </div>

        </div>
    );
}