import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card";
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "./ui/item";
import { Check } from "lucide-react";
import { AutomatiserButton } from "./hero";
import React from "react";
import { Logo } from "./logo";
import { DecorIcon } from "./ui/decor-icon";
import { FullWidthDivider } from "./ui/full-width-divider";

const avantExtraverty = [
  {
    title:
      "Vous perdez du temps à repeter toujours la même reponse a chaque message.",
  },
  { title: "Vous perdez des prospects faute de reponse assez rapide." },
  { title: "Les messages s'accumulent pendant que vous faites autre chose." },
  {
    title:
      "Vous passez des heures dans votre inbox au lieu de developper votre business.",
  },
];
const apresExtraverty = [
  { title: "Chaque question recoit sa reponse rapidement" },
  {
    title:
      "Chaque DM deviens une opportunité de vendre (même si vous n'etes pas en ligne).",
  },
  {
    title:
      "Les prospects sont sauvegardés, étiquetés, tracés — presque livrés clé en main pour vous.",
  },
  {
    title:
      "Et vous ? Enfin, libre de siroter votre cafe pendant qu'il est encore Chaud.",
  },
];

function AvantApres() {
  return (
    <section className="relative w-full flex flex-col items-center justify-center px-2 gap-6 md:gap-10 py-10">
      <DecorIcon className="size-4" position="bottom-left" />
      <DecorIcon className="size-4" position="bottom-right" />
      <div className="flex flex-col justify-center items-center text-center max-w-3xl gap-2">
        <Logo className="w-12" />
        <h3 className="text-center font-bold text-2xl tracking-tight md:text-3xl lg:font-extrabold lg:text-4xl">
          Automatisez vos Conversations WhatsApp avec ExtravertyAI
        </h3>
        <p className="text-muted-foreground">
          Fatigué de perdre du temps à gérer les DM WhatsApp ? Découvrez comment
          ExtravertyAI facilite votre gestion.
        </p>
      </div>
      <div className="flex flex-col md:flex-row justify-center max-w-4xl w-full gap-4">
        <Card className="w-full min-w-75 md:w-1/2 bg-background shadow-sm">
          <CardHeader>
            <CardDescription className="text-center">
              Avant ExtravertyAI:
            </CardDescription>
            <CardTitle className="text-center text-muted-foreground">
              Vous gérez vos inbox à la dure
            </CardTitle>
          </CardHeader>
          <ItemGroup>
            {avantExtraverty.map((item, idx) => (
              <React.Fragment key={idx}>
                <Item className="text-muted-foreground py-1">
                  <ItemMedia>
                    <Check />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{item.title}</ItemTitle>
                  </ItemContent>
                </Item>
                {idx < avantExtraverty.length - 1 && (
                  <ItemSeparator className="w-11/12! my-1 mx-auto" />
                )}
              </React.Fragment>
            ))}
          </ItemGroup>
          <AutomatiserButton
            variant={"outline"}
            className="w-11/12! mt-auto mx-auto"
          />
        </Card>
        <Card className="w-full  min-w-75 md:w-1/2">
          <CardHeader>
            <CardDescription className="text-center">
              Après ExtravertyAI:
            </CardDescription>
            <CardTitle className="text-center ">
              Simplifiez-vous la vie
            </CardTitle>
          </CardHeader>
          <ItemGroup>
            {apresExtraverty.map((item, idx) => (
              <React.Fragment key={idx}>
                <Item className="py-1">
                  <ItemMedia className="h-12 w-12 rounded-full bg-primary text-primary-foreground">
                    <Check />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{item.title}</ItemTitle>
                  </ItemContent>
                </Item>
                {idx < apresExtraverty.length - 1 && (
                  <ItemSeparator className="w-11/12! my-1 mx-auto" />
                )}
              </React.Fragment>
            ))}
          </ItemGroup>
          <AutomatiserButton className="w-11/12! mt-auto mx-auto" />
        </Card>
      </div>
      <FullWidthDivider className="-bottom-px" />
    </section>
  );
}

export default AvantApres;
