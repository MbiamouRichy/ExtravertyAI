import Image from "next/image"
import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Item, ItemContent, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from "./ui/item";
import { Check } from "lucide-react";
import { Fragment } from "react/jsx-runtime";
import { AutomatiserButton } from "./hero";

const avantExtraverty=[{ title: "Vous perdez du temps à repeter toujours la même reponse a chaque message." },  {title:"Vous perdez des prospects faute de reponse assez rapide."}, {title:"Les messages s'accumulent pendant que vous faites autre chose."},{title:"Vous passez des heures dans votre inbox au lieu de developper votre business."}];
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
      "Et vous ? Enfin, libre de siroter votre cafe pendant qu'i' est encore Chaud.",
  },
];


function AvantApres() {
  return (
    <section className="w-full flex flex-col items-center justify-center gap-6 md:gap-10 py-10">
      <div className="flex flex-col justify-center items-center text-center max-w-3xl gap-2">
        <Image
          src={"/logo.png"}
          alt="logo"
          width={100}
          height={100}
          className="dark:hidden block"
        />
        <Image
          src={"/logo.png"}
          alt="logo"
          width={100}
          height={100}
          className="dark:block hidden"
        />
        <h3>Automatisez vos Conversations WhatsApp avec extravertyAl</h3>
        <p className="text-muted-foreground">
          Fatigué de perdre du temps à gérer les DM WhatsApp ? Découvrez comment
          extravertyAI facilite votre gestion.
        </p>
      </div>
      <div className="flex flex-col md:flex-row justify-center max-w-4xl w-full px-2 gap-4">
        <Card className="w-full min-w-75 md:w-1/2 shadow">
          <CardHeader>
            <CardDescription className="text-center">
              Avant ExtravertyAI:
            </CardDescription>
            <CardTitle className="text-center text-muted-foreground">
              Vous gerez vos inbox à la dure
            </CardTitle>
          </CardHeader>
          <ItemGroup>
            {avantExtraverty.map((item, idx) => (
              <Fragment key={idx}>
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
              </Fragment>
            ))}
          </ItemGroup>
          <AutomatiserButton className="w-11/12! mx-auto" />
        </Card>
        <Card className="w-full  min-w-75 md:w-1/2 shadow bg-accent-foreground! text-accent">
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
              <Fragment key={idx}>
                <Item className="py-1">
                  <ItemMedia className="h-12 w-12 rounded-full text-accent-foreground bg-accent">
                    <Check />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{item.title}</ItemTitle>
                  </ItemContent>
                </Item>
                {idx < apresExtraverty.length - 1 && (
                  <ItemSeparator className="w-11/12! my-1 mx-auto bg-accent" />
                )}
              </Fragment>
            ))}
          </ItemGroup>
          <AutomatiserButton  className="w-11/12! mx-auto bg-accent! text-accent-foreground hover:bg-accent/80!" />
        </Card>
      </div>
    </section>
  );
}

export default AvantApres