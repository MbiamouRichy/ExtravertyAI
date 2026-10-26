"use client";

import { useTransition, type TransitionStartFunction } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { transferProjectOwnership } from "@/app/actions/team";
import { authClient } from "@/lib/auth-client";
import { useHaptics } from "@/lib/webHaptics";

type Member = { id: string; name: string; email: string };

export function TransferOwnershipDialog({
  member,
  projectId,
  onClose,
}: {
  member: Member | null;
  projectId: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <AlertDialog
      open={!!member}
      onOpenChange={(open) => !open && !isPending && onClose()}
    >
      <AlertDialogContent className="max-h-[90dvh] overflow-y-auto">
        {member && (
          // Keyed so the confirmation schema and field reset for each member.
          <TransferForm
            key={member.id}
            member={member}
            projectId={projectId}
            onClose={onClose}
            isPending={isPending}
            startTransition={startTransition}
          />
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

function TransferForm({
  member,
  projectId,
  onClose,
  isPending,
  startTransition,
}: {
  member: Member;
  projectId: string;
  onClose: () => void;
  isPending: boolean;
  startTransition: TransitionStartFunction;
}) {
  const router = useRouter();
  const { playHaptic } = useHaptics();
  const expected = member.email.trim().toLowerCase();
  const schema = z.object({
    confirmation: z
      .string()
      .trim()
      .min(1, "Saisissez l’adresse e-mail du membre.")
      .refine((value) => value.toLowerCase() === expected, {
        message: "L’adresse ne correspond pas à celle du membre.",
      }),
  });
  type FormValues = z.infer<typeof schema>;
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { confirmation: "" },
  });

  async function reconnect() {
    await authClient.signOut();
    router.replace(
      `/sign-in?callbackUrl=${encodeURIComponent(`/projects/${projectId}/team`)}`,
    );
  }

  const onSubmit = () =>
    startTransition(async () => {
      const result = await transferProjectOwnership({
        projectId,
        membershipId: member.id,
      });
      if (result.success) {
        playHaptic("success");
        toast.success(result.message);
        onClose();
        router.refresh();
        return;
      }
      playHaptic("error");
      toast.error(result.error, {
        action:
          result.code === "REAUTH_REQUIRED"
            ? { label: "Se reconnecter", onClick: () => void reconnect() }
            : undefined,
      });
    });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <AlertDialogHeader>
        <AlertDialogTitle className="flex items-center gap-2">
          <Crown className="size-5" aria-hidden />
          Transférer la propriété
        </AlertDialogTitle>
        <AlertDialogDescription>
          <strong className="text-foreground">{member.name}</strong> deviendra
          propriétaire du projet&nbsp;: facturation, abonnement et suppression
          du projet. Vous resterez membre avec le rôle Administrateur.
        </AlertDialogDescription>
      </AlertDialogHeader>

      <FieldGroup className="my-5">
        <Controller
          name="confirmation"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="transfer-confirmation">
                Adresse e-mail du nouveau propriétaire
              </FieldLabel>
              <Input
                {...field}
                id="transfer-confirmation"
                type="email"
                inputMode="email"
                autoComplete="off"
                spellCheck={false}
                placeholder={member.email}
                aria-invalid={fieldState.invalid}
                disabled={isPending}
              />
              <FieldDescription>
                Tapez{" "}
                <span className="font-medium text-foreground">{member.email}</span>{" "}
                pour confirmer. Seul le nouveau propriétaire pourra vous rendre
                ce rôle.
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>

      <AlertDialogFooter>
        <AlertDialogCancel type="button" disabled={isPending}>
          Annuler
        </AlertDialogCancel>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="animate-spin" aria-hidden />}
          {isPending ? "Transfert…" : "Transférer la propriété"}
        </Button>
      </AlertDialogFooter>
    </form>
  );
}
