import {
  ClockIcon,
  MessagesSquareIcon,
  SmileIcon,
  SparklesIcon,
  TimerIcon,
  TrendingUpIcon,
  ZapIcon,
} from "lucide-react";
import React from "react";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "./ui/item";
import { Card } from "./ui/card";
import { DecorIcon } from "./ui/decor-icon";
import { FullWidthDivider } from "./ui/full-width-divider";
import PhoneMockup from "./phoneMockup";
import { AutomatiserButton } from "./hero";

const feature = [
  {
    icon: SmileIcon,
    title: "98%",
    description: "Clients satisfaits",
  },
  {
    icon: TimerIcon,
    title: "< 3s",
    description: "Temps de reponses moyen",
  },
  {
    icon: TrendingUpIcon,
    title: "+35%",
    description: "Ventes en moyenne",
  },
];

const features2 = [
  {
    icon: ZapIcon,
    title: "Reponse instantanée",
    description: "Moin de 03secondes pour répondre à vos clients",
  },
  {
    icon: MessagesSquareIcon,
    title: "Comprehension avancée",
    description: "L'IA comprend le client et repond comme un humain",
  },
  {
    icon: ClockIcon,
    title: "Disponible 24H/24",
    description: "Ne manquez plus jamias un client même la nuit",
  },
];

function Demo() {
  return (
    <section
      className="w-full relative flex flex-col items-center md:items-start gap-4 py-10 md:py-24 px-2 md:px-6 lg:px-12"
      id="demo"
    >
      <DecorIcon className="size-4" position="bottom-left" />
      <DecorIcon className="size-4" position="bottom-right" />

      <FullWidthDivider className="-top-px" />
      <p className="text-xs text-primary bg-primary-foreground w-fit px-3 py-1 rounded-md inline-flex items-center gap-2">
        <SparklesIcon className="fill-primary size-4 " /> Demo en direct
      </p>
      <div className="flex flex-col-reverse md:flex-row gap-4 items-center justify-between w-full">
        <div className="flex flex-col text-center md:text-left gap-3 w-full md:grow md:max-w-6/10">
          <h2 className="text-2xl tracking-tight md:text-3xl lg:font-extrabold lg:text-4xl">
            Voyez ExtravertyAI en action
          </h2>
          <p className="text-sm text-muted-foreground">
            Découvrez comment notre assistant IA répond à vos clients
            instantanément. 24h/24 et 7j/7.
          </p>
          <div className="flex flex-col justify-between my-4 items-center gap-4">
            {features2.map((feature, idx) => (
              <Item
                key={idx}
                className="w-full p-0 flex-row items-center justify-start"
              >
                <ItemMedia
                  variant="icon"
                  className=" border border-border shrink-0 h-12 w-12 rounded-full"
                >
                  {<feature.icon />}
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="whitespace-pre-line">
                    {feature.title}
                  </ItemTitle>
                  <ItemDescription>{feature.description}</ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </div>

          <Card className="w-full min-w-full flex flex-row justify-between items-center gap-4 p-2 md:p-4 bg-background shadow-sm">
            {feature.map((feature, idx) => (
              <Item
                key={idx}
                className="w-full p-0 flex flex-col items-center justify-center"
              >
                <ItemMedia variant="icon" className="self-center!">
                  {<feature.icon className="size-12" />}
                </ItemMedia>
                <ItemContent className="items-center text-center">
                  <ItemTitle className="whitespace-pre-line text-2xl">
                    {feature.title}
                  </ItemTitle>
                  <ItemDescription className="text-center">
                    {feature.description}
                  </ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </Card>

          <div className="flex flex-col gap-1 mt-6 md:mt-8">
            <p className="text-sm md:text-base font-medium">
              Prêt à ne plus perdre des clients sur WhatsApp ?
            </p>
            <p className="text-sm text-muted-foreground mb-2">
              Rejoignez les nombreuses entreprises qui utilisent déjà
              ExtravertyAI et ne manquer plus jamais un client sur WhatsApp.
            </p>
            <AutomatiserButton text="Commencer maintenant" className="w-full" />
          </div>
        </div>
        <PhoneMockup videoSrc="/video.mp4" />
      </div>
      <FullWidthDivider className="-bottom-px" />
    </section>
  );
}

export default Demo;
