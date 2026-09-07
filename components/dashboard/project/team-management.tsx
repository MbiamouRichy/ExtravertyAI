"use client";

import { useState } from "react";
import {
    MoreHorizontal,
    Plus,
    Search,
    ShieldCheck,
    UserIcon,
    Mail,
    Trash2,
    ShieldAlert,
    InfoIcon
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner"; // Remplacer par useToast si vous utilisez le toast de base shadcn
import { useHaptics } from "@/lib/webHaptics";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// --- TYPES (Basés sur votre schéma Prisma) ---
type Role = "OWNER" | "ADMIN" | "USER";

// Type combinant le User et le ProjectMembership pour l'affichage
interface TeamMember {
    id: string; // ProjectMembership ID
    userId: string;
    name: string;
    email: string;
    image?: string | null;
    role: Role;
    createdAt: Date;
}

// --- MOCK DATA (À remplacer par vos Server Actions / Prisma) ---
const mockMembers: TeamMember[] = [
    {
        id: "mem_1",
        userId: "usr_1",
        name: "Alexandre",
        email: "alexandre@extraverty.ai",
        image: "https://github.com/shadcn.png",
        role: "OWNER",
        createdAt: new Date("2023-01-15"),
    },
    {
        id: "mem_2",
        userId: "usr_2",
        name: "Sarah Connors",
        email: "sarah.c@extraverty.ai",
        role: "ADMIN",
        createdAt: new Date("2023-06-20"),
    },
    {
        id: "mem_3",
        userId: "usr_3",
        name: "Marc Dupont",
        email: "marc.d@extraverty.ai",
        role: "USER",
        createdAt: new Date("2024-02-10"),
    },
];

export default function TeamManagement({ projectId }: { projectId: string }) {
    const [members, setMembers] = useState<TeamMember[]>(mockMembers);
    const [searchQuery, setSearchQuery] = useState("");
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<Role>("USER");
    const { playHaptic } = useHaptics(); // Hook personnalisé pour les retours haptiques
    console.log("Project ID:", projectId); // Debug: Vérifier que le projectId est bien reçu
    // Utilisateur actuellement connecté (simulé)
    const currentUserRole: Role = "OWNER";

    const filteredMembers = members.filter(
        (member) =>
            member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            member.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getRoleBadge = (role: Role) => {
        switch (role) {
            case "OWNER":
                return <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none"><ShieldAlert className="w-3 h-3 mr-1" /> Propriétaire</Badge>;
            case "ADMIN":
                return <Badge variant="secondary"><ShieldCheck className="w-3 h-3 mr-1" /> Admin</Badge>;
            case "USER":
                return <Badge variant="outline"><UserIcon className="w-3 h-3 mr-1" /> Utilisateur</Badge>;
        }
    };

    const handleInvite = (e: React.FormEvent) => {
        e.preventDefault();
        // TODO: Appel API via Server Action
        playHaptic("success"); // Retour haptique pour succès
        toast.success(`Invitation envoyée à ${inviteEmail}`);
        setIsInviteOpen(false);
        setInviteEmail("");
    };

    const handleRemoveMember = (memberId: string, memberName: string) => {
        // TODO: Appel API via Server Action
        playHaptic("success"); // Retour haptique pour succès
        setMembers(members.filter((m) => m.id !== memberId));
        toast.success(`${memberName} a été retiré de l'équipe.`);
    };

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-8">
            {/* HEADER SECTION */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Équipe & Accès</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Gérez les membres de votre projet, leurs rôles et leurs permissions d&apos;accès au CRM WhatsApp.
                    </p>
                </div>

                {/* MODAL D'INVITATION */}
                <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2 shadow-sm">
                            <Plus className="w-4 h-4" />
                            Inviter un membre
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Inviter un collaborateur</DialogTitle>
                            <DialogDescription>
                                Un email sera envoyé avec un lien pour rejoindre l&apos;espace de travail extravertyAI.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleInvite} className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <label htmlFor="email" className="text-sm font-medium">Adresse email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="agent@entreprise.com"
                                        className="pl-9"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="role" className="text-sm font-medium">Rôle (Permissions)</label>
                                <Select value={inviteRole} onValueChange={(val) => setInviteRole(val as Role)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Sélectionnez un rôle" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ADMIN">Administrateur (Gestion complète)</SelectItem>
                                        <SelectItem value="USER">Agent / Utilisateur (Peut répondre aux messages)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <DialogFooter className="pt-4">
                                <Button variant="outline" type="button" onClick={() => setIsInviteOpen(false)}>Annuler</Button>
                                <Button type="submit">Envoyer l&apos;invitation</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
            <Alert className="w-full">
                <InfoIcon className="h-4 w-4" />
                <AlertTitle>Politique de sécurité extravertyAI</AlertTitle>
                <AlertDescription className="text-muted-foreground">
                    Les membres avec le rôle <strong>ADMIN </strong> ou <strong>OWNER </strong> peuvent modifier les paramètres du projet, recuperer les données de ce dernier et accéder aux informations de facturation Stripe. Assignez ces rôles avec précaution.
                </AlertDescription>
            </Alert>
            {/* SEARCH BAR */}
            <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Rechercher par nom ou email..."
                    className="pl-9 bg-background shadow-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* TEAM LIST (CARD STYLE) */}
            <Card className="shadow-sm border-border">
                <CardHeader className="border-b bg-muted/40 pb-4">
                    <CardTitle className="text-lg">Membres actifs</CardTitle>
                    <CardDescription>
                        {members.length} membre(s) ont accès à ce projet.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-border">
                        {filteredMembers.map((member) => (
                            <div key={member.id} className="flex items-center justify-between p-4 sm:px-6 hover:bg-muted/20 transition-colors">

                                {/* INFO UTILISATEUR */}
                                <div className="flex items-center gap-4">
                                    <Avatar className="h-10 w-10 border">
                                        <AvatarImage src={member.image || ""} alt={member.name} />
                                        <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                            {member.name.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm">{member.name}</span>
                                        <span className="text-xs text-muted-foreground">{member.email}</span>
                                    </div>
                                </div>

                                {/* ROLE ET ACTIONS */}
                                <div className="flex items-center gap-4">
                                    <div className="hidden sm:block">
                                        {getRoleBadge(member.role)}
                                    </div>

                                    {/* MENU D'ACTIONS (Si l'utilisateur actuel a les droits) */}
                                    {(currentUserRole === "OWNER" || (currentUserRole === "ADMIN" && member.role === "USER")) && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                    <span className="sr-only">Ouvrir le menu</span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuSeparator />

                                                {/* Changement de rôle impossible pour le OWNER */}
                                                {member.role !== "OWNER" && (
                                                    <>
                                                        <DropdownMenuItem onClick={() => toast.info("Fonctionnalité en cours de dev")}>
                                                            Changer le rôle
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                                                            onClick={() => handleRemoveMember(member.id, member.name)}
                                                        >
                                                            <Trash2 className="w-4 h-4 mr-2" />
                                                            Retirer de l&apos;équipe
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                                {member.role === "OWNER" && (
                                                    <DropdownMenuItem disabled>
                                                        Le propriétaire ne peut être modifié
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                            </div>
                        ))}

                        {filteredMembers.length === 0 && (
                            <div className="p-8 text-center text-muted-foreground">
                                Aucun membre trouvé pour &quot;${searchQuery}&quot;.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}