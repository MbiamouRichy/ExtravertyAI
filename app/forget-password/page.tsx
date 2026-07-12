import ForgetPasswordForm from "@/components/auth/forgetPasswordForm";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Zana - Mot de passe oublié ?",
  description:
    "Renitialisez votre mot de passe en entrant votre adresse e-mail. Nous vous enverrons un lien pour créer un nouveau mot de passe.",
};
export const dynamic = "force-static";

export default function ForgetPasswordPage() {
  return (
      <ForgetPasswordForm />
  );
}
