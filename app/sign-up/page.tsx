import { AuthPage } from "@/components/auth/signUpPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "S'inscrire | ExtravertyAI",
};
export const dynamic = "force-static";

export default function DemoPage() {
    return <AuthPage />;
}