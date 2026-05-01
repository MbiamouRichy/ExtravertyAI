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
} from "./ui/item";
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
import { Separator } from "./ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AutomatiserButton } from "./hero";
import { Logo } from "./logo";
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
    <div className="relative w-full px-2 md:px-0">
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

        <div className="py-8 md:py-16 lg:py-20 md:px-12 lg:px-16 w-full flex flex-col gap-4 md:gap-6">
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
              <p className="text-sm text-foreground/80 dark:md:text-foreground/80 md:text-primary-foreground/80 pb-4">
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
                      <ItemTitle className="whitespace-pre-line">
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
                  <ItemTitle>
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
                  <ItemTitle>Oui, allons-y !</ItemTitle>
                  <ItemFooter className="justify-end text-xs text-muted-foreground">
                    <span>11h:31</span>
                  </ItemFooter>
                </ItemContent>
              </Item>
              <Item className="rounded-2xl ml-auto shadow-sm max-w-xs w-auto  text-primary-foreground bg-foreground">
                <ItemContent>
                  <ItemTitle className="flex-col items-start gap-0">
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

          <div className="w-full md:mt-6 md:mx-auto py-1 px-2 rounded-md bg-card flex flex-col md:flex-row justify-between md:justify-evenly md:items-center">
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
                    <ItemTitle>{feature.title}</ItemTitle>
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
    </div>
  );
}

export const WhatsAppIcon = (props: React.ComponentProps<"svg">) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    {...props}
    viewBox="0 0 16 16"
    fill="currentColor"
  >
    <path d="M8.002 0h-.004C3.587 0 0 3.588 0 8a7.94 7.94 0 0 0 1.523 4.689l-.997 2.972 3.075-.983A7.93 7.93 0 0 0 8.002 16C12.413 16 16 12.411 16 8s-3.587-8-7.998-8zm4.655 11.297c-.193.545-.959.997-1.57 1.129-.418.089-.964.16-2.802-.602-2.351-.974-3.865-3.363-3.983-3.518-.113-.155-.95-1.265-.95-2.413s.583-1.707.818-1.947c.193-.197.512-.287.818-.287.099 0 .188.005.268.009.235.01.353.024.508.395.193.465.663 1.613.719 1.731.057.118.114.278.034.433-.075.16-.141.231-.259.367-.118.136-.23.24-.348.386-.108.127-.23.263-.094.498.136.23.606.997 1.298 1.613.893.795 1.617 1.049 1.876 1.157.193.08.423.061.564-.089.179-.193.4-.513.625-.828.16-.226.362-.254.574-.174.216.075 1.359.64 1.594.757.235.118.39.174.447.273.056.099.056.564-.137 1.11z"></path>
  </svg>
);
