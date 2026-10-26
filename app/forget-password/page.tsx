import ForgetPasswordForm from "@/components/auth/forgetPasswordForm";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Mot de passe oublié | ExtravertyAI",
  description:
    "Renitialisez votre mot de passe en entrant votre adresse e-mail. Nous vous enverrons un lien pour créer un nouveau mot de passe.",
};

export default function ForgetPasswordPage() {
  return (
      <ForgetPasswordForm />
  );
}
