"use client";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from "@/components/ui/input-group"

import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field"
import {
    UserIcon,
    AtSignIcon
} from "lucide-react";
import { SubscribeButton } from "@/components/suscribeButton";
import { PLANS } from "@/lib/stripe-plans";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { User } from "better-auth";

function ProfileUtilisateur({ user }: { user: User }) {
    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <UserIcon className="h-5 w-5 text-neutral-500" />
                    Profil Utilisateur
                </CardTitle>
                <CardDescription>
                    Mettez à jour vos informations de connexion.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 w-full">
                <div className="flex items-center gap-4 mb-4">
                    <Avatar className="h-16 w-16 border border-neutral-200">
                        <AvatarImage src="" alt={user.name} />
                        <AvatarFallback className="bg-neutral-100 text-neutral-900 text-xl font-medium">
                            {user.name.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-medium text-neutral-900">{user.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="bg-neutral-100 text-neutral-600 hover:bg-neutral-100 pointer-events-none">
                                Verified
                            </Badge>
                        </div>
                    </div>
                </div>

                <FieldGroup>
                    <Field>
                        <FieldLabel htmlFor="block-start-input">Nom complet</FieldLabel>
                        <InputGroup>
                            <InputGroupInput readOnly id="name" type="text" defaultValue={user.name} className="focus-visible:ring-neutral-400" disabled />
                            <InputGroupAddon>
                                <UserIcon className="text-muted-foreground" />
                            </InputGroupAddon>
                        </InputGroup>
                    </Field>
                    <Field>
                        <FieldLabel htmlFor="email">Adresse e-mail</FieldLabel>
                        <InputGroup aria-disabled={true}>
                            <InputGroupInput readOnly id="email" type="email" defaultValue={user.email} className="focus-visible:ring-neutral-400" disabled />
                            <InputGroupAddon>
                                <AtSignIcon className="text-muted-foreground" />
                            </InputGroupAddon>
                            <InputGroupAddon align="inline-end">
                                <InputGroupButton variant="outline" className="cursor-pointer">
                                    Modifier
                                </InputGroupButton>
                            </InputGroupAddon>
                        </InputGroup>
                        <FieldDescription>
                            L&apos;adresse e-mail est liée à votre authentification.
                        </FieldDescription>
                    </Field>
                </FieldGroup>
            </CardContent>
            <CardFooter className="bg-neutral-50 border-t border-neutral-100 justify-end">
                {/* <ModifierProfile user={user}>
                    <Button >
                        Enregistrer les modifications
                    </Button>
                </ModifierProfile> */}
                <Button
                    onClick={() => {
                        signOut()
                        redirect("/sign-in");
                    }}
                    className="w-full cursor-pointer"
                    variant="destructive">Se déconnecter</Button>
                <Button >
                    Modifier le profil
                </Button>
                <SubscribeButton priceId={PLANS.STARTER.priceId} />
            </CardFooter>
        </Card>
    )
}

export default ProfileUtilisateur