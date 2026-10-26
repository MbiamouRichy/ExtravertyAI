"use client";

import * as React from "react";
// 1. Ajout de useEffect
import { useState, useTransition, useEffect } from "react";
// 2. Ajout de useRouter pour rafraîchir les données serveur
import { useRouter } from "next/navigation";
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
  Loader2,
  AlertTriangle,
  Crown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
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
import { TransferOwnershipDialog } from "./transfer-ownership-dialog";
import { MemberPresence, useProjectPresence } from "../user/member-presence";
import { getInitials } from "@/components/getInitials";
import { AssignNextButton } from "./assign-next-button";

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

export default function TeamManagement({
  projectId,
  currentUserId,
  data,
}: TeamManagementProps) {
  const presence = useProjectPresence(projectId);
  const router = useRouter(); // <-- Initialisation du router

  // État global
  const [members, setMembers] = useState<TeamMember[]>(data);
  const [searchQuery, setSearchQuery] = useState("");

  // 3. SYNCHRONISATION : Met à jour l'état local si les données serveur (props 'data') changent
  useEffect(() => {
    setMembers(data);
  }, [data]);

  // Modal Inviter
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isInviting, startInviteTransition] = useTransition();

  // Modal Supprimer
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [memberToEditRole, setMemberToEditRole] = useState<TeamMember | null>(
    null,
  );
  const [memberToTransfer, setMemberToTransfer] = useState<TeamMember | null>(
    null,
  );
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
  const currentUserRole: Role = currentUserMembership?.role ?? "USER";

  // Filtrage dynamique
  const filteredMembers = members.filter(
    (member) =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const getRoleBadge = (role: Role) => {
    const meta = {
      OWNER: { label: "Propriétaire", icon: ShieldAlert, strong: true },
      ADMIN: { label: "Admin", icon: ShieldCheck, strong: false },
      USER: { label: "Agent", icon: UserIcon, strong: false },
    }[role];
    const Icon = meta.icon;
    return (
      <Badge
        variant={meta.strong ? "default" : "outline"}
        className={meta.strong ? "font-medium" : "text-muted-foreground"}
      >
        <Icon data-icon="inline-start" />
        {meta.label}
      </Badge>
    );
  };

  // --- 2. ACTION : INVITER UN MEMBRE ---
  const onSubmitInvite = (formData: InviteFormValues) => {
    // Renommé formData pour éviter un conflit de nom avec les props `data`
    startInviteTransition(async () => {
      const res = await inviteTeamMember(
        formData.email,
        formData.role as Role,
        projectId,
      );

      if (res.success) {
        playHaptic("success");
        toast.success(`Invitation envoyée à ${formData.email}`);
        setIsInviteOpen(false);
        form.reset();

        // 4. RAFRAÎCHISSEMENT : Demande à Next.js de recharger les données (ce qui déclenchera le useEffect plus haut)
        router.refresh();
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
        // Mise à jour optimiste (l'UI réagit tout de suite)
        setMembers((prev) => prev.filter((m) => m.id !== memberToDelete.id));
        setMemberToDelete(null);

        // On s'assure que le serveur est bien synchro
        router.refresh();
      } else {
        playHaptic("error");
        toast.error(res.error || "Erreur lors de la suppression.");
      }
    });
  };

  const rolePriority = {
    OWNER: 1,
    ADMIN: 2,
    USER: 3,
  };

  // Trier les membres en fonction de ce poids
  const sortedMembers = [...filteredMembers].sort((a, b) => {
    const priorityA = rolePriority[a.role] || 3;
    const priorityB = rolePriority[b.role] || 3;
    return priorityA - priorityB;
  });

  const roleCards = [
    {
      role: "OWNER" as const,
      label: "Propriétaire",
      icon: Crown,
      text: "Accès complet, facturation et suppression du projet.",
    },
    {
      role: "ADMIN" as const,
      label: "Administrateurs",
      icon: ShieldCheck,
      text: "Réglages, équipe, exports et facturation Stripe.",
    },
    {
      role: "USER" as const,
      label: "Agents",
      icon: UserIcon,
      text: "Répondent aux conversations de la messagerie.",
    },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-8 p-4 sm:p-6 xl:p-8">
      <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Équipe
          </p>
          <h1 className="mt-1 text-3xl md:text-4xl">Équipe et accès</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Invitez vos collaborateurs et choisissez ce que chacun peut voir et
            modifier.
          </p>
        </div>

        <Dialog open={isInviteOpen} onOpenChange={handleInviteModalChange}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus data-icon="inline-start" />
              Inviter un membre
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Inviter un collaborateur</DialogTitle>
              <DialogDescription>
                Un e-mail d&apos;invitation lui permettra de rejoindre le projet.
              </DialogDescription>
            </DialogHeader>

            <form
              id="invite-member-form"
              noValidate
              onSubmit={form.handleSubmit(onSubmitInvite)}
              className="pt-2"
            >
              <FieldGroup>
                <Controller
                  name="email"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="invite-email">Adresse e-mail</FieldLabel>
                      <InputGroup>
                        <InputGroupInput
                          {...field}
                          id="invite-email"
                          type="email"
                          inputMode="email"
                          placeholder="agent@entreprise.com"
                          aria-invalid={fieldState.invalid}
                          disabled={isInviting}
                          autoComplete="off"
                        />
                        <InputGroupAddon align="inline-start">
                          <Mail />
                        </InputGroupAddon>
                      </InputGroup>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />

                <Controller
                  name="role"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <FieldSet data-invalid={fieldState.invalid}>
                      <FieldLegend variant="label">Rôle</FieldLegend>
                      <RadioGroup
                        name={field.name}
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isInviting}
                        className="gap-2"
                      >
                        {(
                          [
                            { value: "USER", title: "Agent", text: "Répond aux conversations." },
                            { value: "ADMIN", title: "Administrateur", text: "Gère réglages, équipe et facturation." },
                          ] as const
                        ).map((option) => (
                          <FieldLabel
                            key={option.value}
                            htmlFor={`invite-role-${option.value}`}
                            className="cursor-pointer rounded-xl border p-3 font-normal has-data-[state=checked]:border-primary has-data-[state=checked]:bg-muted/50"
                          >
                            <Field orientation="horizontal">
                              <RadioGroupItem id={`invite-role-${option.value}`} value={option.value} />
                              <span className="flex flex-col">
                                <span className="text-sm font-medium">{option.title}</span>
                                <span className="text-xs text-muted-foreground">{option.text}</span>
                              </span>
                            </Field>
                          </FieldLabel>
                        ))}
                      </RadioGroup>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </FieldSet>
                  )}
                />
              </FieldGroup>

              <DialogFooter className="pt-6">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => handleInviteModalChange(false)}
                  disabled={isInviting}
                >
                  Annuler
                </Button>
                <Button type="submit" form="invite-member-form" disabled={isInviting}>
                  {isInviting && <Loader2 className="animate-spin" aria-hidden="true" />}
                  Envoyer l&apos;invitation
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <section aria-label="Rôles" className="grid gap-3 sm:grid-cols-3">
        {roleCards.map(({ role, label, icon: Icon, text }) => (
          <div key={role} className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="flex size-8 items-center justify-center rounded-lg border bg-background">
                <Icon aria-hidden="true" className="size-4" />
              </span>
              <span className="font-heading text-2xl font-bold tabular-nums">
                {members.filter((member) => member.role === role).length}
              </span>
            </div>
            <p className="mt-3 text-sm font-medium">{label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{text}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="members-title" className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 id="members-title" className="font-heading text-base font-semibold tracking-tight">
              Membres
            </h2>
            <p className="text-xs text-muted-foreground">
              {members.length} personne{members.length > 1 ? "s" : ""} ont accès à ce projet
            </p>
          </div>
          <InputGroup className="sm:max-w-64">
            <InputGroupInput
              type="search"
              placeholder="Rechercher un membre…"
              aria-label="Rechercher un membre par nom ou e-mail"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              maxLength={100}
            />
            <InputGroupAddon align="inline-start">
              <Search />
            </InputGroupAddon>
          </InputGroup>
        </div>

        <ul className="divide-y">
          {sortedMembers.map((member) => {
            const canManageMember =
              currentUserRole === "OWNER" ||
              (currentUserRole === "ADMIN" && member.role === "USER");
            const isMe = member.userId === currentUserId;

            return (
              <li
                key={member.id}
                className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/30 sm:items-center sm:px-5"
              >
                <Avatar className="size-10 shrink-0">
                  <AvatarImage src={member.image || undefined} alt="" />
                  <AvatarFallback className="font-heading text-xs font-semibold">
                    {getInitials(member.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <span className="truncate">{member.name || "Utilisateur"}</span>
                    {isMe && (
                      <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] font-normal text-muted-foreground">
                        Vous
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  {/* Mobile : rôle et présence sous l’email, pour laisser la largeur au nom. */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground sm:mt-0.5">
                    <span className="sm:hidden">{getRoleBadge(member.role)}</span>
                    <span className="whitespace-nowrap">
                      <MemberPresence
                        status={
                          presence.error
                            ? undefined
                            : presence.data?.find((p) => p.userId === member.userId)?.status
                        }
                      />
                    </span>
                    <span aria-hidden="true" className="text-muted-foreground/60">
                      ·
                    </span>
                    <span className="whitespace-nowrap tabular-nums">
                      {(member.assigned ?? 0).toLocaleString("fr-FR")}{" "}
                      {(member.assigned ?? 0) > 1 ? "assignées" : "assignée"}
                    </span>
                  </div>
                  {/* Mobile : l’action passe sous les informations. */}
                  {member.role !== "OWNER" && (
                    <AssignNextButton
                      projectId={projectId}
                      assigneeId={member.userId}
                      assigneeName={member.name || "ce membre"}
                      className="mt-2.5 sm:hidden"
                    />
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="hidden sm:inline-flex">{getRoleBadge(member.role)}</span>
                  {/* Le propriétaire choisit ses conversations lui-même. */}
                  {member.role !== "OWNER" && (
                    <AssignNextButton
                      projectId={projectId}
                      assigneeId={member.userId}
                      assigneeName={member.name || "ce membre"}
                      className="hidden sm:inline-flex"
                    />
                  )}
                  {!isMe && canManageMember && member.role !== "OWNER" ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${member.name}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel className="truncate">{member.name}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => setMemberToEditRole(member)}>
                          <ShieldCheck />
                          Changer le rôle
                        </DropdownMenuItem>
                        {currentUserRole === "OWNER" && (
                          <DropdownMenuItem onSelect={() => setMemberToTransfer(member)}>
                            <Crown />
                            Transférer la propriété
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setMemberToDelete(member)}>
                          <Trash2 />
                          Retirer de l&apos;équipe
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <span aria-hidden="true" className="hidden size-8 sm:block" />
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {filteredMembers.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <Search aria-hidden="true" className="size-5 text-muted-foreground" />
            <p className="text-sm font-medium">Aucun membre trouvé</p>
            <p className="text-xs text-muted-foreground">
              {searchQuery ? `Aucun résultat pour « ${searchQuery} ».` : "Invitez un premier collaborateur."}
            </p>
          </div>
        )}
      </section>

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
              Cette action révoquera immédiatement tous les accès de{" "}
              <strong>{memberToDelete?.email}</strong> à ce projet CRM WhatsApp.
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

      <TransferOwnershipDialog
        member={memberToTransfer}
        projectId={projectId}
        onClose={() => setMemberToTransfer(null)}
      />

      <ChangeRoleModal
        isOpen={!!memberToEditRole}
        onClose={() => setMemberToEditRole(null)}
        member={memberToEditRole}
        projectId={projectId}
        currentUserRole={currentUserRole}
        onSuccess={(selectedRole: Role) => {
          // Mise à jour optimiste
          setMembers((prev) =>
            prev.map((m) =>
              m.id === memberToEditRole?.id ? { ...m, role: selectedRole } : m,
            ),
          );
          // On s'assure que le serveur est bien synchro
          router.refresh();
        }}
      />
    </div>
  );
}
