"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useHaptics } from "@/lib/webHaptics";
import { useState } from "react";
import * as z from "zod";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { CameraIcon, Loader, UserIcon } from "lucide-react";
import { User } from "better-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Input } from "@/components/ui/input";
import { updateProfileAction } from "@/app/actions/upload";
import { getInitials } from "@/components/getInitials";
import { useSession } from "@/lib/auth-client";
import { profileImageError } from "@/lib/profile-image";

const formSchema = z.object({
  nom: z
    .string()
    .min(2, "Le nom doit contenir au moins 2 caractères.")
    .max(50, "Le nom doit contenir au maximum 50 caractères."),
  image: z
    .instanceof(File)
    .nullable()
    .refine((file) => !file || !profileImageError(file), {
      message:
        "Choisissez une image JPEG, PNG ou WEBP non vide de 2 Mo maximum.",
    }),
});

export function ModifierProfile({
  children,
  open,
  setOpen,
  user,
}: {
  children?: React.ReactNode;
  open?: boolean;
  setOpen?: (open: boolean) => void;
  user: User;
}) {
  const isMobile = useIsMobile();

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger className="cursor-pointer" asChild>
          {children}
        </DialogTrigger>
        <DialogContent className="sm:max-w-106.25">
          <DialogHeader>
            <DialogTitle>Modifier le profil</DialogTitle>
            <DialogDescription>
              Faites des modifications à votre profil ici. Cliquez sur
              enregistrer lorsque vous avez terminé.
            </DialogDescription>
          </DialogHeader>
          <ProfileForm user={user} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger className="cursor-pointer" asChild>
        {children}
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Modifier le profil</DrawerTitle>
          <DrawerDescription>
            Faites des modifications à votre profil ici. Cliquez sur enregistrer
            lorsque vous avez terminé.
          </DrawerDescription>
        </DrawerHeader>
        <ProfileForm user={user} className="p-4" />
      </DrawerContent>
    </Drawer>
  );
}

function ProfileForm({
  className,
  user,
}: React.ComponentProps<"form"> & { user: User }) {
  const { playHaptic } = useHaptics();
  const { refetch } = useSession();
  const [savedImage, setSavedImage] = useState(user.image);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: { nom: user.name, image: null },
  });
  const loading = form.formState.isSubmitting;
  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function onSubmit(data: z.infer<typeof formSchema>) {
    try {
      const formData = new FormData();
      formData.append("nom", data.nom);
      if (data.image) formData.append("file", data.image);
      const result = await updateProfileAction(formData);
      if (!result.success) throw new Error(result.error);
      // Verify the persisted image, not just the local preview, before announcing success.
      if (data.image && result.user.image) {
        await new Promise<void>((resolve, reject) => {
          const image = new window.Image();
          const fail = () =>
            reject(
              new Error(
                "Le profil est enregistré, mais la photo ne peut pas être affichée. Veuillez réessayer.",
              ),
            );
          const timeout = window.setTimeout(fail, 15000);
          image.onload = () => {
            window.clearTimeout(timeout);
            resolve();
          };
          image.onerror = () => {
            window.clearTimeout(timeout);
            fail();
          };
          image.src = result.user.image!;
        });
      }
      setSavedImage(result.user.image);
      setPreview(null);
      form.reset({ nom: result.user.name, image: null });
      if (fileInput.current) fileInput.current.value = "";
      await refetch();
      playHaptic("success");
      toast.success("Informations mises à jour avec succès.", {
        position: "top-center",
      });
    } catch (error) {
      playHaptic("error");
      toast.error("Échec de la mise à jour", {
        description:
          error instanceof Error
            ? error.message
            : "Impossible de mettre à jour le profil.",
        position: "top-center",
      });
    }
  }

  return (
    <form
      className={className}
      id="profile-Form"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <FieldGroup className="gap-4">
        <Controller
          name="image"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="items-center">
              <FieldLabel htmlFor="profile-image">Photo de profil</FieldLabel>
              <div className="relative mx-auto size-32 shrink-0 rounded-full focus-within:ring-2 focus-within:ring-ring">
                <Avatar className="size-full overflow-hidden rounded-full border border-border">
                  <AvatarImage
                    src={preview ?? savedImage ?? undefined}
                    alt={user.name}
                    className="object-cover object-center"
                  />
                  <AvatarFallback className="bg-muted text-foreground text-xl font-medium">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <Button
                  type="button"
                  tabIndex={-1}
                  aria-hidden="true"
                  variant="outline"
                  size="icon-sm"
                  className="rounded-full absolute bottom-0 right-0 pointer-events-none"
                >
                  <CameraIcon />
                </Button>
                <Input
                  id="profile-image"
                  type="file"
                  name={field.name}
                  ref={(element) => {
                    field.ref(element);
                    fileInput.current = element;
                  }}
                  disabled={loading}
                  onBlur={field.onBlur}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={`profile-image-description${fieldState.invalid ? " profile-image-error" : ""}`}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const selected = event.target.files?.[0];
                    if (selected) {
                      field.onChange(selected);
                      setPreview(
                        profileImageError(selected)
                          ? null
                          : URL.createObjectURL(selected),
                      );
                    }
                  }}
                />
              </div>
              <FieldDescription id="profile-image-description">
                JPEG, PNG ou WEBP, 2 Mo maximum.
              </FieldDescription>
              {fieldState.invalid && (
                <FieldError
                  id="profile-image-error"
                  errors={[fieldState.error]}
                />
              )}
            </Field>
          )}
        />
        <Controller
          name="nom"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="profile-name">Votre nom</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  {...field}
                  id="profile-name"
                  autoComplete="name"
                  disabled={loading}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={
                    fieldState.invalid ? "profile-name-error" : undefined
                  }
                />
                <InputGroupAddon>
                  <UserIcon />
                </InputGroupAddon>
              </InputGroup>
              {fieldState.invalid && (
                <FieldError
                  id="profile-name-error"
                  errors={[fieldState.error]}
                />
              )}
            </Field>
          )}
        />
        <Button disabled={loading} type="submit">
          {loading && <Loader className="animate-spin" />}
          Enregistrer
        </Button>
      </FieldGroup>
    </form>
  );
}
