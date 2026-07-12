import { DecorIcon } from "@/components/ui/decor-icon";
import { FullWidthDivider } from "@/components/ui/full-width-divider";
import Image from "next/image";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemMedia,
  ItemTitle,
} from "../ui/item";
import {
  CheckCheck,
  LinkIcon,
  MessageCircleMoreIcon,
  MessageSquareTextIcon,
  SparklesIcon,
  TrendingUpIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import { Separator } from "../ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AutomatiserButton } from "./hero";
import { Logo } from "../logo";
import React from "react";

const features = [
  {
    icon: ZapIcon,
    title: "Reponse instantanée",
    description: "24/7",
  },
  {
    icon: TrendingUpIcon,
    title: "Plus d'engagement",
    description: "Plus de conversions",
  },
  {
    icon: SparklesIcon,
    title: "Gain de temps",
    description: "Focus sur l'essentiel",
  },
];

const features2 = [
  {
    icon: MessageCircleMoreIcon,
    title: `Repondez automatiquement\naux messages`,
  },
  {
    icon: UsersIcon,
    title: "Gagnez de nouveaux\nfollowers",
  },
  {
    icon: MessageSquareTextIcon,
    title: "Repondez aux commentaires\ninstantanément",
  },
  {
    icon: LinkIcon,
    title: "Partager des liens\nen un clic",
  },
];

export default function HeroImage() {
  return (
    <section className="relative w-full px-2 md:px-0">
      <DecorIcon className="size-4" position="top-left" />
      <DecorIcon className="size-4" position="top-right" />
      <DecorIcon className="size-4" position="bottom-left" />
      <DecorIcon className="size-4" position="bottom-right" />

      <FullWidthDivider className="-top-px" />
      <div className="overflow-hidden relative h-full w-full">
        <Image
          alt="hero image"
          loading="lazy"
          src="/heroImage.png"
          fill
          sizes="1200"
          className=" object-cover hidden md:block absolute top-0 left-0 -z-10 w-full min-h-max h-full dark:brightness-[0.9]"
        />

        <div className="py-8 md:py-16 lg:py-20 md:px-12 lg:px-16 w-full flex flex-col gap-4 md:gap-6 scroll-mt-24">
          <Item className="flex p-0 mb-6 gap-0.5 flex-row items-center justify-start w-auto">
            <ItemMedia
              variant={"icon"}
              className="bg-primary-foreground border border-border dark:border-0 dark:bg-none rounded-full h-12 w-12"
            >
              <Logo className="w-10" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle className="text-foreground dark:md:text-foreground md:text-primary-foreground">
                ExtravertyAI
              </ItemTitle>
              <ItemDescription className="text-foreground/80 dark:md:text-foreground/80 md:text-primary-foreground/80">
                Service d{`'`}automatisation
              </ItemDescription>
            </ItemContent>
          </Item>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full text-foreground dark:md:text-foreground md:text-primary-foreground">
            <div className="flex flex-col text-center md:text-left gap-2 md:gap-6">
              <h2 className="text-foreground/90 dark:md:text-foreground/90 md:text-primary-foreground/90 ">
                Automatisez vos <br /> réponses WhatsApp.
                <br />
                <span className="text-foreground dark:md:text-foreground md:text-primary-foreground underline">
                  Gagnez du temps, <br /> boostez votre business.
                </span>
              </h2>
              <p className="text-base text-foreground/80 dark:md:text-foreground/80 md:text-primary-foreground/80 pb-4">
                L{`'`}IA au service de conversations <br /> rapides, humaines et
                efficaces.
              </p>
              <div className="flex flex-col gap-1">
                {features2.map((feature, idx) => (
                  <Item
                    key={idx}
                    className="w-full p-0 flex-row items-center justify-start"
                  >
                    <ItemMedia
                      variant="icon"
                      className=" border border-border h-12 w-12 rounded-full"
                    >
                      {<feature.icon />}
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle className="whitespace-pre-line text-sm md:text-base">
                        {feature.title}
                      </ItemTitle>
                    </ItemContent>
                  </Item>
                ))}
              </div>

              <AutomatiserButton
                text="Commencer maintenant"
                className="w-full md:w-fit"
              />
            </div>
            <div className="hidden md:flex flex-col gap-2 h-full justify-center items-center">
              <Item className="rounded-2xl ml-auto shadow-sm max-w-xs w-auto  text-primary-foreground bg-foreground">
                <ItemContent>
                  <ItemTitle className="text-sm md:text-base">
                    Salut ! Prêt à automatiser vos réponses WhatsApp ?
                  </ItemTitle>
                  <ItemFooter className="justify-end text-xs text-muted-foreground">
                    <span>11h:30</span>
                    <CheckCheck size={"15"} data-icon="inline-end" />
                  </ItemFooter>
                </ItemContent>
              </Item>
              <Item className=" flex mr-auto flex-row justify-center items-center max-w-xs  ">
                <ItemMedia>
                  <Avatar className="shadow-sm">
                    <AvatarImage src="avatar/img1.png" />
                    <AvatarFallback>Av</AvatarFallback>
                  </Avatar>
                </ItemMedia>
                <ItemContent className="text-foreground rounded-2xl px-4 py-3.5 shadow-sm bg-primary-foreground">
                  <ItemTitle className="text-sm md:text-base">Oui, allons-y !</ItemTitle>
                  <ItemFooter className="justify-end text-xs text-muted-foreground">
                    <span>11h:31</span>
                  </ItemFooter>
                </ItemContent>
              </Item>
              <Item className="rounded-2xl ml-auto shadow-sm max-w-xs w-auto  text-primary-foreground bg-foreground">
                <ItemContent>
                  <ItemTitle className="flex-col text-sm md:text-base items-start gap-0">
                    Voici le lien que vous avez demandé. Profitez-en ! <br />
                    <p className="text-blue-500 underline">
                      https://extravertyai.com
                    </p>
                  </ItemTitle>
                  <ItemFooter className="justify-end text-xs text-muted-foreground">
                    <span>11h:31</span>
                    <CheckCheck size={"15"} data-icon="inline-end" />
                  </ItemFooter>
                </ItemContent>
              </Item>
            </div>
          </div>

          <div className="w-full md:mt-6 md:mx-auto py-1 px-2 rounded-md bg-background flex flex-col md:flex-row justify-between md:justify-evenly md:items-center">
            {features.map((feature, idx) => (
              <React.Fragment key={idx}>
                <Item className="w-full px-0 md:px-4 flex flex-col lg:flex-row items-center justify-start md:justify-center md:w-auto">
                  <ItemMedia
                    className="bg-muted self-center! lg:self-start!  h-12 w-12 rounded-full"
                    variant={"icon"}
                  >
                    {<feature.icon className="fill-primary" />}
                  </ItemMedia>
                  <ItemContent className="text-center items-center lg:items-start justify-center lg:justify-start">
                    <ItemTitle className="text-base">{feature.title}</ItemTitle>
                    <ItemDescription className="text-center! lg:text-left!">
                      {feature.description}
                    </ItemDescription>
                  </ItemContent>
                </Item>
                {idx < features.length - 1 && (
                  <>
                    <Separator
                      orientation="vertical"
                      className="hidden md:block mx-8 h-12 my-auto"
                    />
                    <Separator className="mx-auto block md:hidden w-34! my-1" />
                  </>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
      <FullWidthDivider className="-bottom-px" />
    </section>
  );
}


