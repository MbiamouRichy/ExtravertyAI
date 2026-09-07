"use client";

import React, { useState, useTransition } from "react";
import { Role } from "@/src/generated/prisma/client";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Shield, ShieldAlert, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { updateMemberRole } from "@/app/actions/team";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRouter } from "next/navigation";

interface MemberToEdit {
    id: string; // ProjectMembership ID
    role: Role;
    name: string | null;
    email: string;
    image?: string | null;
}

interface ChangeRoleModalProps {
    isOpen: boolean;
    onClose: () => void;
    member: MemberToEdit | null;
    projectId: string;
    currentUserRole: Role;
}

const ROLE_DESCRIPTIONS: Record<Role, string> = {
    OWNER: "Accès total au projet, gestion de la facturation et transfert de propriété.",
    ADMIN: "Gestion de l'équipe, invitation de membres et accès complet aux fonctionnalités du projet.",
    USER: "Accès standard aux fonctionnalités du projet sans droits de gestion d'équipe.",
};

export function ChangeRoleModal({
    isOpen,
    onClose,
    member,
    projectId,
    currentUserRole,
}: ChangeRoleModalProps) {
    const [selectedRole, setSelectedRole] = useState<Role>(member?.role ?? "USER")
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    if (!member) return null;

    const handleRoleChange = () => {
        if (selectedRole === member.role) {
            onClose();
            return;
        }

        startTransition(async () => {
            const result = await updateMemberRole({
                projectId,
                membershipId: member.id,
                newRole: selectedRole,
            });

            if (result.success) {
                toast.success(result.message || "Rôle mis à jour avec succès.");
                router.refresh();
                onClose();
            } else {
                toast.error(result.error || "Impossible de modifier le rôle.");
            }
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && !isPending && onClose()}>
            <DialogContent className="sm:max-w-121.25 border-border/80 shadow-2xl">
                <DialogHeader className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <Shield className="w-5 h-5" />
                        </div>
                        <DialogTitle className="text-lg font-bold">
                            Changer le rôle du membre
                        </DialogTitle>
                    </div>
                    <DialogDescription className="text-xs text-muted-foreground">
                        Ajustez les privilèges d&apos;accès de cet utilisateur au sein du projet.
                    </DialogDescription>
                </DialogHeader>

                {/* RÉSUMÉ DU MEMBRE */}
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-muted/40 border border-border/60 my-2">
                    <Avatar className="h-10 w-10 border border-border">
                        <AvatarImage src={member.image || undefined} alt={member.name || ""} />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                            {member.name ? member.name.substring(0, 2).toUpperCase() : "U"}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-medium text-sm text-foreground truncate">
                            {member.name || "Utilisateur"}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">{member.email}</span>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs font-mono">
                        Rôle actuel : {member.role}
                    </Badge>
                </div>

                {/* SÉLECTION DU NOUVEAU RÔLE */}
                <div className="space-y-3">
                    <label className="text-xs font-semibold text-foreground tracking-wide uppercase">
                        Nouveau rôle attribué
                    </label>
                    <Select
                        value={selectedRole}
                        onValueChange={(value) => setSelectedRole(value as Role)}
                        disabled={isPending}
                    >
                        <SelectTrigger className="w-full h-11 mt-2">
                            <SelectValue placeholder="Sélectionnez un rôle" />
                        </SelectTrigger>
                        <SelectContent>
                            {currentUserRole === "OWNER" && (
                                <SelectItem value="ADMIN" className="cursor-pointer">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">Administrateur</span>
                                    </div>
                                </SelectItem>
                            )}
                            <SelectItem value="USER" className="cursor-pointer">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">Membre (Utilisateur)</span>
                                </div>
                            </SelectItem>
                        </SelectContent>
                    </Select>

                    {/* DESCRIPTION DYNAMIQUE DU RÔLE */}
                    <div className="p-3 text-xs bg-primary/5 text-primary border border-primary/15 rounded-lg flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                        <p className="leading-relaxed">{ROLE_DESCRIPTIONS[selectedRole]}</p>
                    </div>

                    {/* AVERTISSEMENT EN CAS DE PROMOTION ADMIN */}
                    {selectedRole === "ADMIN" && member.role !== "ADMIN" && (
                        <Alert className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                            <AlertTitle className="text-sm">Attention :</AlertTitle>
                            <AlertDescription className="leading-relaxed text-xs">
                                Un administrateur peut inviter, modifier et supprimer des membres standards du projet.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-border/40">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onClose}
                        disabled={isPending}
                    >
                        Annuler
                    </Button>
                    <Button
                        type="button"
                        onClick={handleRoleChange}
                        disabled={isPending || selectedRole === member.role}
                        className="min-w-30"
                    >
                        {isPending ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Mise à jour...
                            </>
                        ) : (
                            "Enregistrer"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}