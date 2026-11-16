"use client";

import Image from "next/image";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  getCountries,
  getCountryCallingCode,
  isSupportedCountry,
} from "libphonenumber-js/max";
import { Check, ChevronDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const countryNames = new Intl.DisplayNames(["fr"], { type: "region" });
/** Minuscules sans accents : « senegal » trouve « Sénégal ». */
const fold = (text: string) =>
  text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const phoneCountries = getCountries()
  .map((code) => {
    const name = countryNames.of(code) ?? code;
    const callingCode = getCountryCallingCode(code);
    return {
      code,
      name,
      callingCode,
      folded: fold(name),
      search: fold(`${name} ${code} +${callingCode}`),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, "fr"));

type CountryPickerProps = {
  id: string;
  name: string;
  value: string;
  onChange: (code: string) => void;
  onBlur: () => void;
  invalid: boolean;
  triggerRef?: React.Ref<HTMLButtonElement>;
};

/**
 * Pays du numéro : liste déroulante sur ordinateur, tiroir avec recherche
 * sur mobile et tablette (même seuil que le profil), où une longue liste
 * déroulante est difficile à parcourir au doigt.
 */
export function CountryPicker(props: CountryPickerProps) {
  const isMobile = useIsMobile();
  return isMobile ? <CountryDrawer {...props} /> : <CountrySelect {...props} />;
}

function CountrySelect({
  id,
  name,
  value,
  onChange,
  onBlur,
  invalid,
  triggerRef,
}: CountryPickerProps) {
  return (
    <Select name={name} value={value} onValueChange={onChange}>
      <SelectTrigger
        id={id}
        ref={triggerRef}
        onBlur={onBlur}
        aria-invalid={invalid}
        className="w-full min-w-0 data-[size=default]:h-11"
      >
        {/* L’indicatif figure déjà dans le champ du numéro. */}
        <SelectValue placeholder="Choisir un pays">
          {isSupportedCountry(value) && <CountryLabel code={value} />}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        position="popper"
        align="start"
        // Largeur bornée : les noms longs sont tronqués, jamais
        // l’indicatif, et la liste ne dépasse pas de l’écran.
        className="max-h-80 w-(--radix-select-trigger-width) min-w-[min(18rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)]"
      >
        {phoneCountries.map((country) => (
          <SelectItem
            key={country.code}
            value={country.code}
            textValue={`${country.name} ${country.code} +${country.callingCode}`}
            className="min-h-10 *:[span]:last:w-full *:[span]:last:min-w-0"
          >
            <CountryFlag code={country.code} />
            <span className="min-w-0 truncate">{country.name}</span>
            <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">
              +{country.callingCode}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CountryDrawer({
  id,
  value,
  onChange,
  onBlur,
  invalid,
  triggerRef,
}: CountryPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLUListElement>(null);
  const selected = isSupportedCountry(value) ? value : null;
  const listId = `${id}-list`;

  const results = useMemo(() => {
    const term = fold(query.trim());
    if (!term) return phoneCountries;
    // Les noms qui commencent par la recherche d'abord : « ga » → Gabon,
    // Gambie… avant Portugal ou Sénégal.
    return phoneCountries
      .filter((country) => country.search.includes(term))
      .sort(
        (a, b) =>
          Number(!a.folded.startsWith(term)) - Number(!b.folded.startsWith(term)),
      );
  }, [query]);

  // Ouverture : le pays choisi apparaît au milieu de la liste.
  const showSelected = useCallback((element: HTMLButtonElement | null) => {
    element?.scrollIntoView({ block: "center" });
  }, []);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      // Comme un champ quitté : la validation « au toucher » s'applique.
      onBlur();
    }
  }

  return (
    <Drawer open={open} onOpenChange={changeOpen}>
      <DrawerTrigger asChild>
        <Button
          id={id}
          ref={triggerRef}
          type="button"
          variant="outline"
          aria-invalid={invalid}
          className="h-11 w-full min-w-0 justify-start gap-1.5 border-input bg-transparent pr-2 pl-2.5 font-normal aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
        >
          {selected ? (
            <CountryLabel code={selected} />
          ) : (
            <span className="truncate text-muted-foreground">Choisir un pays</span>
          )}
          <ChevronDown aria-hidden="true" className="ml-auto size-4 text-muted-foreground" />
        </Button>
      </DrawerTrigger>
      <DrawerContent
        className="h-[80dvh]"
        // Pas de clavier à l'ouverture : le pays choisi reçoit le focus, la
        // recherche reste à un geste.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          const current = listRef.current?.querySelector<HTMLButtonElement>(
            "[aria-current=true]",
          );
          (current ?? (event.currentTarget as HTMLElement)).focus({ preventScroll: true });
        }}
      >
        <DrawerHeader className="text-left">
          <DrawerTitle>Pays du numéro</DrawerTitle>
          <DrawerDescription>L’indicatif s’ajoute au numéro WhatsApp.</DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-3">
          <InputGroup className="h-11">
            <InputGroupAddon>
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pays ou indicatif"
              aria-label="Rechercher un pays ou un indicatif"
              aria-controls={listId}
              autoComplete="off"
              enterKeyHint="search"
              className="text-base"
            />
          </InputGroup>
        </div>
        <ul
          ref={listRef}
          id={listId}
          aria-label="Pays"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t px-2 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          {results.map((country) => {
            const checked = country.code === selected;
            return (
              <li key={country.code}>
                <Button
                  ref={checked && !query ? showSelected : undefined}
                  type="button"
                  variant="ghost"
                  aria-current={checked ? "true" : undefined}
                  onClick={() => {
                    onChange(country.code);
                    changeOpen(false);
                  }}
                  className={cn(
                    "h-12 w-full justify-start gap-3 px-3 text-base font-normal",
                    checked && "bg-muted",
                  )}
                >
                  <CountryFlag code={country.code} />
                  <span className="min-w-0 truncate">{country.name}</span>
                  <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">
                    +{country.callingCode}
                  </span>
                  <Check
                    aria-hidden="true"
                    className={cn("size-4 shrink-0", !checked && "invisible")}
                  />
                </Button>
              </li>
            );
          })}
          {results.length === 0 && (
            <li role="status" className="px-3 py-10 text-center text-sm text-muted-foreground">
              Aucun pays ne correspond à « {query.trim()} ».
            </li>
          )}
        </ul>
      </DrawerContent>
    </Drawer>
  );
}

function CountryLabel({ code }: { code: string }) {
  return (
    <>
      <CountryFlag code={code} />
      <span className="truncate">{countryNames.of(code) ?? code}</span>
    </>
  );
}

// Fichiers locaux : Windows n’affiche pas les emojis de drapeaux.
function CountryFlag({ code }: { code: string }) {
  return (
    <Image
      src={`/flags/${code}.svg`}
      alt=""
      width={21}
      height={14}
      unoptimized
      className="h-3.5 w-[21px] shrink-0 rounded-xs object-cover ring-1 ring-border"
    />
  );
}
