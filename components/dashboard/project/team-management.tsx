"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    MoreHorizontal,
    Plus,
    Search,
    ShieldCheck,
    UserIcon,
    Mail,
    Trash2,
    ShieldAlert,
    InfoIcon,
    Loader2,
    AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";

import { toast } from "sonner";
import { useHaptics } from "@/lib/webHaptics";

// Importations des Server Actions & Types
import {
    removeTeamMember,
    inviteTeamMember,
    type TeamMember,
} from "@/app/actions/team";
import { Role } from "@/src/generated/prisma/client";
import { ChangeRoleModal } from "./changeRoleModal";

// --- 1. SCHÉMA DE VALIDATION ZOD ---
const inviteSchema = z.object({
    email: z
        .string()
        .min(1, "L'adresse email est requise.")
        .email("Veuillez entrer une adresse email valide."),
    role: z.enum(["ADMIN", "USER"], {
        message: "Veuillez sélectionner un rôle.",
    }),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

interface TeamManagementProps {
    projectId: string;
    currentUserId?: string;
    data: TeamMember[];
}

export default function TeamManagement({ projectId, currentUserId, data }: TeamManagementProps) {
    // État global
    const [members, setMembers] = useState<TeamMember[]>(data);
    const [searchQuery, setSearchQuery] = useState("");

    // Modal Inviter
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [isInviting, startInviteTransition] = useTransition();

    // Modal Supprimer
    const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);
    const [isDeleting, startDeleteTransition] = useTransition();
    const [memberToEditRole, setMemberToEditRole] = useState<TeamMember | null>(null);
    const { playHaptic } = useHaptics();

    // Configuration React Hook Form
    const form = useForm<InviteFormValues>({
        resolver: zodResolver(inviteSchema),
        defaultValues: {
            email: "",
            role: "USER",
        },
    });

    // Rôle de l'utilisateur connecté
    const currentUserMembership = members.find((m) => m.userId === currentUserId);
    const currentUserRole: Role = currentUserMembership?.role ?? "OWNER";

    // Filtrage dynamique
    const filteredMembers = members.filter(
        (member) =>
            member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            member.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getRoleBadge = (role: Role) => {
        switch (role) {
            case "OWNER":
                return (
                    <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border-amber-500/20 font-medium">
                        <ShieldAlert className="w-3 h-3 mr-1" /> Propriétaire
                    </Badge>
                );
            case "ADMIN":
                return (
                    <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 border-indigo-500/20 font-medium">
                        <ShieldCheck className="w-3 h-3 mr-1" /> Admin
                    </Badge>
                );
            case "USER":
                return (
                    <Badge variant="outline" className="text-muted-foreground">
                        <UserIcon className="w-3 h-3 mr-1" /> Agent
                    </Badge>
                );
        }
    };

    // --- 2. ACTION : INVITER UN MEMBRE ---
    const onSubmitInvite = (data: InviteFormValues) => {
        startInviteTransition(async () => {
            const res = await inviteTeamMember(data.email, data.role as Role, projectId);

            if (res.success) {
                playHaptic("success");
                toast.success(`Invitation envoyée à ${data.email}`);
                setIsInviteOpen(false);
                form.reset();
            } else {
                playHaptic("error");
                toast.error(res.error || "Impossible d'envoyer l'invitation.");
            }
        });
    };

    // Gère la fermeture de la modal proprement
    const handleInviteModalChange = (open: boolean) => {
        setIsInviteOpen(open);
        if (!open) form.reset();
    };

    // --- 3. ACTION : SUPPRIMER UN MEMBRE ---
    const handleConfirmRemove = () => {
        if (!memberToDelete) return;

        startDeleteTransition(async () => {
            const res = await removeTeamMember(memberToDelete.id, projectId);

            if (res.success) {
                playHaptic("success");
                toast.success(`${memberToDelete.name} a été retiré de l'équipe.`);
                setMembers((prev) => prev.filter((m) => m.id !== memberToDelete.id));
                setMemberToDelete(null);
            } else {
                playHaptic("error");
                toast.error(res.error || "Erreur lors de la suppression.");
            }
        });
    };
    const rolePriority = {
        OWNER: 1,
        ADMIN: 2,
        USER: 3
    };

    // Trier les membres en fonction de ce poids
    const sortedMembers = [...filteredMembers].sort((a, b) => {
        const priorityA = rolePriority[a.role] || 3; // 99 par défaut si le rôle n'est pas reconnu
        const priorityB = rolePriority[b.role] || 3;

        return priorityA - priorityB;
    });
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
                <Dialog open={isInviteOpen} onOpenChange={handleInviteModalChange}>
                    <DialogTrigger asChild>
                        <Button className="gap-2 shadow-sm font-medium">
                            <Plus className="w-4 h-4" />
                            Inviter un membre
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Inviter un collaborateur</DialogTitle>
                            <DialogDescription>
                                Un email d&apos;invitation sera envoyé avec les accès au projet.
                            </DialogDescription>
                        </DialogHeader>

                        <form id="invite-member-form" onSubmit={form.handleSubmit(onSubmitInvite)} className="space-y-4 pt-2">
                            <FieldGroup>
                                {/* CHAMP EMAIL */}
                                <Controller
                                    name="email"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="invite-email">
                                                Adresse email
                                            </FieldLabel>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    {...field}
                                                    id="invite-email"
                                                    type="email"
                                                    placeholder="agent@entreprise.com"
                                                    className="pl-9"
                                                    aria-invalid={fieldState.invalid}
                                                    disabled={isInviting}
                                                    autoComplete="off"
                                                />
                                            </div>
                                            {fieldState.invalid && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}
                                        </Field>
                                    )}
                                />

                                {/* CHAMP RÔLE */}
                                <Controller
                                    name="role"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="invite-role">
                                                Rôle (Permissions)
                                            </FieldLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                                disabled={isInviting}
                                            >
                                                <SelectTrigger className="min-w-full" id="invite-role" aria-invalid={fieldState.invalid}>
                                                    <SelectValue placeholder="Sélectionnez un rôle" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="ADMIN">
                                                        Administrateur (Gestion complète)
                                                    </SelectItem>
                                                    <SelectItem value="USER">
                                                        Agent / Utilisateur (Réponse aux messages)
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {fieldState.invalid && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}
                                        </Field>
                                    )}
                                />
                            </FieldGroup>

                            <DialogFooter className="pt-4">
                                <Button
                                    variant="outline"
                                    type="button"
                                    onClick={() => handleInviteModalChange(false)}
                                    disabled={isInviting}
                                >
                                    Annuler
                                </Button>
                                <Button type="submit" form="invite-member-form" disabled={isInviting}>
                                    {isInviting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Envoyer l&apos;invitation
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* ALERT SÉCURITÉ */}
            <Alert className="border-border bg-muted/30">
                <InfoIcon className="h-4 w-4 text-primary" />
                <AlertTitle className="font-semibold">Politique de sécurité extravertyAI</AlertTitle>
                <AlertDescription className="text-muted-foreground leading-relaxed mt-1">
                    Les membres avec le rôle <strong>ADMIN</strong> ou <strong>OWNER</strong> peuvent modifier les paramètres du projet, récupérer les données et accéder aux informations de facturation Stripe. Assignez ces rôles avec précaution.
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

            {/* TEAM LIST CARD */}
            <Card className="shadow-sm border-border">
                <CardHeader className="border-b bg-muted/20 pb-4">
                    <CardTitle className="text-lg">Membres actifs</CardTitle>
                    <CardDescription>
                        {members.length} membre(s) ont accès à ce projet.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-border">
                        {/* LISTE DES MEMBRES */}
                        {sortedMembers.map((member) => {
                            const canManageMember =
                                currentUserRole === "OWNER" ||
                                (currentUserRole === "ADMIN" && member.role === "USER");

                            return (
                                <div
                                    key={member.id}
                                    className="flex items-center justify-between p-4 sm:px-6 hover:bg-muted/10 transition-colors"
                                >
                                    {/* INFO UTILISATEUR */}
                                    <div className="flex items-center gap-4">
                                        <Avatar className="h-10 w-10 border border-border">
                                            <AvatarImage src={member.image || undefined} alt={member.name} />
                                            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                                                {member.name ? member.name.substring(0, 2).toUpperCase() : "U"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-sm text-foreground">
                                                {member.name || "Utilisateur"}
                                            </span>
                                            <span className="text-xs text-muted-foreground">{member.email}</span>
                                        </div>
                                    </div>

                                    {/* RÔLE ET ACTIONS */}


                                    {canManageMember && (
                                        <div className="flex items-center gap-4">
                                            <div>{getRoleBadge(member.role)}</div>
                                            {member.role !== "OWNER" && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                        >
                                                            <MoreHorizontal className="h-4 w-4" />
                                                            <span className="sr-only">Ouvrir le menu</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-fit max-w-xs">
                                                        <DropdownMenuLabel>Actions sur {member.name}</DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onSelect={() => setMemberToEditRole(member)}
                                                        >
                                                            Changer le rôle
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                                                            onClick={() => setMemberToDelete(member)}
                                                        >
                                                            <Trash2 className="w-4 h-4 mr-2" />
                                                            Retirer de l&apos;équipe
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </div>

                                    )}
                                </div>
                            );
                        })}

                        {/* AUCUN RÉSULTAT */}
                        {filteredMembers.length === 0 && (
                            <div className="p-8 text-center text-muted-foreground text-sm">
                                {searchQuery
                                    ? `Aucun membre trouvé pour "${searchQuery}".`
                                    : "Aucun membre présent dans ce projet."}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* CONFIRMATION DIALOG DE SUPPRESSION */}
            <AlertDialog
                open={!!memberToDelete}
                onOpenChange={(open) => !open && setMemberToDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            Retirer {memberToDelete?.name} ?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Cette action révoquera immédiatement tous les accès de <strong>{memberToDelete?.email}</strong> à ce projet CRM WhatsApp.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleConfirmRemove();
                            }}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Confirmer la suppression
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <ChangeRoleModal
                isOpen={!!memberToEditRole}
                onClose={() => setMemberToEditRole(null)}
                member={memberToEditRole}
                projectId={projectId}
                currentUserRole={currentUserRole}
            />
        </div>
    );
}