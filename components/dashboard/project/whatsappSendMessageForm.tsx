"use client";

import { useState } from "react";
import {
    Send, Bot, User as UserIcon, Search,
    Phone, CheckCheck, MoreVertical, ShieldAlert, ArrowLeft, MessageCircle,
    Check,
    Play,
    Pause
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
import confetti from "canvas-confetti";
import { useEffect } from "react";
import { toast } from "sonner";
import { sendWhatsAppMessage } from "@/app/actions/sendWhatsAppMessage";
import { ChatClient, ChatMessage, getWorkspaceData } from "@/app/actions/getMessages&Contacts";
import { useHaptics } from "@/lib/webHaptics";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

// ------------------------------------------------------
// 📦 TYPES & INTERFACES
// ------------------------------------------------------
type Project = { id: string; name: string };
type User = { id: string; name?: string | null; image?: string | null };

// ------------------------------------------------------
// 🎨 COMPOSANT PRINCIPAL
// ------------------------------------------------------
interface WorkspaceProps {
    project: Project;
    user: User;
    isSuccess: boolean;
}

export default function WhatsappWorkspace({ project, user, isSuccess }: WorkspaceProps) {
    const [clients, setClients] = useState<ChatClient[]>([]);
    const [messagesMap, setMessagesMap] = useState<Record<string, ChatMessage[]>>({});
    const [activeClientId, setActiveClientId] = useState<string | null>(null);

    const [input, setInput] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [showMobileChat, setShowMobileChat] = useState<boolean>(false);
    const { playHaptic } = useHaptics();
    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            const result = await getWorkspaceData(project.id);

            if (isMounted) {
                if (result.success && result.clients && result.messages) {
                    setClients(result.clients);
                    setMessagesMap(result.messages);

                    // CORRECTION : On utilise la version fonctionnelle du setter.
                    // Cela évite de dépendre de l'état `activeClientId` de l'extérieur.
                    if (result.clients.length > 0) {
                        const firstClientId = result.clients[0].id;
                        setActiveClientId((prev) => {
                            // Si prev est null (aucun client sélectionné), on met le premier.
                            // Sinon, on garde le client actuellement sélectionné (prev).
                            return prev === null ? firstClientId : prev;
                        });
                    }
                } else {
                    toast.error(result.error || "Erreur de chargement");
                }
            }
        };

        fetchData();

        return () => { isMounted = false; };
    }, [project.id]);

    // 2. DÉRIVATION DES MESSAGES DU CLIENT ACTIF
    const activeMessages = activeClientId ? (messagesMap[activeClientId] || []) : [];
    const activeClient = clients.find(c => c.id === activeClientId);

    const handleSelectClient = (clientId: string) => {
        setActiveClientId(clientId);
        setShowMobileChat(true);
    };

    // 3. GESTION DES CONFETTIS
    useEffect(() => {
        if (!isSuccess) return;

        const duration = 5 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval = window.setInterval(() => {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            confetti({
                ...defaults,
                particleCount,
                origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
            });
            confetti({
                ...defaults,
                particleCount,
                origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
            });
        }, 250);

        return () => clearInterval(interval);
    }, [isSuccess]);

    // 4. ENVOI DU MESSAGE (Optimistic UI)
    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();

        const messageContent = input.trim();
        if (!messageContent || isSending || !activeClient || !project || !user) return;

        setInput("");
        setIsSending(true);

        const tempId = `temp-${Date.now()}`;
        const optimisticMessage: ChatMessage = {
            id: tempId,
            senderType: "agent",
            content: messageContent,
            timestamp: new Date(),
            status: "sent",
        };

        // CORRECTION 1 : Mise à jour de messagesMap au lieu de setMessages
        setMessagesMap((prev) => ({
            ...prev,
            [activeClient.id]: [...(prev[activeClient.id] || []), optimisticMessage]
        }));

        try {
            const result = await sendWhatsAppMessage({
                projectId: project.id,
                contactId: activeClient.id,
                content: messageContent,
            });

            if (!result.success || !result.message) {
                throw new Error(result.error || "Erreur inconnue");
            }

            // CORRECTION 2 : Mise à jour du succès dans le dictionnaire messagesMap
            playHaptic("success");
            setMessagesMap((prev) => ({
                ...prev,
                [activeClient.id]: (prev[activeClient.id] || []).map((msg) =>
                    msg.id === tempId
                        ? { ...msg, id: result.message.id, status: "delivered" }
                        : msg
                )
            }));

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Erreur réseau";
            console.error("Erreur d'envoi:", errorMessage);
            playHaptic("error");
            toast.error(errorMessage);

            // CORRECTION 3 : Mise à jour de l'échec dans le dictionnaire messagesMap
            setMessagesMap((prev) => ({
                ...prev,
                [activeClient.id]: (prev[activeClient.id] || []).map((msg) =>
                    msg.id === tempId
                        ? { ...msg, status: "failed" }
                        : msg
                )
            }));

            setInput(messageContent);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="flex w-full h-full max-h-[calc(100vh-4rem)] overflow-hidden!">

            {/* -------------------------------------------------------------------------
          SIDEBAR (Liste des clients)
          > Cachée sur mobile si un chat est ouvert (showMobileChat === true)
      -------------------------------------------------------------------------- */}
            <div className={`w-full md:max-w-2/5 md:border-r flex-col md:bg-muted/10 shrink-0 h-full ${showMobileChat ? 'hidden md:flex' : 'flex'}`}>
                <div className="py-4 px-3 md:border-b md:bg-background/50 md:backdrop-blur-sm">
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

                <ScrollArea className="max-w-full flex-1 h-full">
                    <div className="flex flex-col w-full py-4">
                        {clients.map((client) => (
                            <div
                                key={client.id}
                                onClick={() => handleSelectClient(client.id)}
                                className={`flex items-start gap-3 p-4 text-left w-full cursor-pointer transition-colors border-b last:border-0 ${activeClientId === client.id
                                    ? "bg-primary/5 border-l-2 border-l-primary"
                                    : "hover:bg-muted/50 border-l-2 border-l-blue-500"
                                    }`}
                            >
                                <div className="relative">
                                    <Avatar className="h-12 w-12 border">
                                        <AvatarFallback className="bg-muted text-muted-foreground font-medium">
                                            {client.name.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    {client.aiActive && (
                                        <div className="absolute size-6 -bottom-1 -right-1 bg-blue-500 text-white rounded-full p-0.5 shadow-sm border-2 border-background">
                                            <Bot className="h-4 w-4" />
                                        </div>
                                    )}
                                </div>

                                <div className="min-w-0">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <span className="font-semibold text-sm truncate">{client.name}</span>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">{client.timestamp}</span>
                                    </div>
                                    <div className="flex justify-between shrink-0 relative items-center gap-2">
                                        <p className="text-sm text-muted-foreground truncate line-clamp-1">
                                            {client.lastMessage}
                                        </p>
                                        {client.unread === 0 && (
                                            <Badge className="bg-emerald-500 text-white px-1.5 min-w-5 flex justify-center rounded-full">
                                                {client.unread}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* -------------------------------------------------------------------------
          MAIN AREA (Fenêtre de Chat)
          > Cachée sur mobile si aucun chat n'est actif
      -------------------------------------------------------------------------- */}
            <div className={`flex-1 md:max-w-3/5 w-full overflow-hidden flex-col bg-background/95 relative h-full ${!showMobileChat ? 'hidden md:flex' : 'flex'}`}>

                {activeClient ? (
                    <>
                        {/* HEADER CHAT */}
                        <header className="flex max-w-full items-center justify-between px-1 md:px-6 py-3 md:py-4 border-b bg-background/60 backdrop-blur-md sticky top-0 z-20">
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
                                    <span className="hidden sm:inline">{activeClient.aiActive ? "Gestion par l'IA activé" : "Gestion par l'IA désactivé"}</span>
                                </Badge>
                                <Tooltip delayDuration={1000}>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size={"icon-sm"}>
                                            {activeClient.aiActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="px-2 py-1" side="right">
                                        {activeClient.aiActive ? "Desactiver la gestion par l'IA" : "Activer la gestion par l'IA"} {" "}
                                        <KbdGroup>
                                            <Kbd>⌘</Kbd>
                                            <Kbd>e</Kbd>
                                            <Kbd>a</Kbd>
                                        </KbdGroup>
                                    </TooltipContent>
                                </Tooltip>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </div>
                        </header>

                        {/* ZONE DE SCROLL DES MESSAGES */}
                        <MessageScrollerProvider>
                            <MessageScroller className="flex-1 min-h-0 relative h-full w-full bg-muted/30 dark:bg-background">
                                <MessageScrollerViewport className="px-3 md:px-6 py-6">
                                    <MessageScrollerContent className="w-full mx-auto">

                                        <MessageGroup>
                                            {activeMessages.map((msg, index) => (
                                                <MessageScrollerItem key={msg.id} scrollAnchor={index === activeMessages.length - 1}>

                                                    <Message align={msg.senderType === "client" ? "start" : "end"} className="mb-6">

                                                        <MessageAvatar
                                                            className={
                                                                msg.senderType === "agent" ? "bg-transparent hidden sm:flex" :
                                                                    msg.senderType === "bot" ? "bg-blue-100 text-blue-600 border-blue-200 hidden sm:flex" : ""
                                                            }
                                                        >
                                                            {msg.senderType === "bot" ? (
                                                                <div className="h-8 w-8 flex items-center justify-center">
                                                                    <Bot className="h-4 w-4 text-blue-600" />
                                                                </div>
                                                            ) : msg.senderType === "agent" ? (
                                                                <Avatar className="h-8 w-8 border">
                                                                    <AvatarImage src={user?.image || ""} />
                                                                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                                                        {user?.name ? user.name.substring(0, 2).toUpperCase() : "MOI"}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                            ) : null}
                                                        </MessageAvatar>

                                                        <MessageContent className={msg.senderType === "client" ? "items-start" : "items-end"}>
                                                            <MessageHeader className="hidden sm:flex">
                                                                {
                                                                    msg.senderType === "bot" ? "Assistant IA" :
                                                                        msg.senderType === "agent" && (user?.name || "Vous")
                                                                }
                                                            </MessageHeader>

                                                            <div
                                                                className={`px-4 py-2.5 max-w-[90%] sm:max-w-[80%] text-[15px] leading-relaxed transition-all ${msg.senderType === "client"
                                                                    ? "bg-card border border-border/50 text-foreground shadow-sm  rounded-2xl rounded-tl-sm"
                                                                    : msg.senderType === "bot"
                                                                        ? "text-foreground"
                                                                        : "bg-primary text-white rounded-2xl shadow-sm rounded-tr-sm"
                                                                    }`}
                                                            >
                                                                {msg.content}
                                                            </div>

                                                            <MessageFooter className="gap-1 mt-0.5 text-xs text-muted-foreground/80">
                                                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                {msg.senderType !== "client" && (
                                                                    <>

                                                                        {msg.status === "sent" ? (
                                                                            <Check className="h-4 w-4 text-muted-foreground/80" />
                                                                        ) : (
                                                                            <CheckCheck className={`h-4 w-4 ${msg.status === "read" ? "text-blue-500" : msg.status === "delivered" && "text-muted-foreground"}`} />
                                                                        )}
                                                                    </>
                                                                )
                                                                }
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
                        <div className="p-3 md:p-4 bg-background/80 backdrop-blur-md border-t mt-auto pb-safe">
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
                                        variant={input.trim() ? "default" : "ghost"}
                                        disabled={!input.trim() || isSending}
                                        className='absolute right-1.5 md:right-2 rounded-full md:rounded-xl h-9 w-9 md:h-10 md:w-10 transition-all'>
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
                            Sélectionnez une conversation dans la liste pour lire l&apos;historique ou reprendre la main sur l&apos;IA.
                        </p>
                    </div>
                )}
            </div>

        </div>
    );
}