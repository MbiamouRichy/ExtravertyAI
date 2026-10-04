"use client";

import { useRef, useState, type RefObject } from "react";
import { Popover } from "radix-ui";
import { Smile, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const groups = [
  {
    name: "Visages",
    emojis: [
      ["😀", "Sourire"],
      ["😊", "Heureux"],
      ["😉", "Clin d’œil"],
      ["😄", "Grand sourire"],
      ["😂", "Rire"],
      ["😍", "Adoration"],
      ["🥰", "Affection"],
      ["😎", "Cool"],
      ["🤔", "Réflexion"],
      ["😅", "Sourire gêné"],
      ["😔", "Tristesse"],
      ["🥳", "Fête"],
    ],
  },
  {
    name: "Réactions",
    emojis: [
      ["👍", "Pouce levé"],
      ["👎", "Pouce baissé"],
      ["👏", "Applaudissements"],
      ["🙏", "Merci"],
      ["👋", "Bonjour"],
      ["🤝", "Accord"],
      ["❤️", "Cœur"],
      ["💙", "Cœur bleu"],
      ["✨", "Étincelles"],
      ["🎉", "Félicitations"],
      ["✅", "Confirmé"],
      ["💯", "Cent pour cent"],
    ],
  },
  {
    name: "Travail",
    emojis: [
      ["📅", "Rendez-vous"],
      ["⏰", "Horaire"],
      ["📞", "Téléphone"],
      ["📍", "Adresse"],
      ["📦", "Colis"],
      ["🚚", "Livraison"],
      ["🛒", "Commande"],
      ["💳", "Paiement"],
      ["📝", "Note"],
      ["📎", "Pièce jointe"],
      ["💡", "Idée"],
      ["🚀", "Lancement"],
    ],
  },
] as const;

export function ChatEmojiPicker({
  draft,
  textareaRef,
  onChange,
  disabled,
}: {
  draft: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selection = useRef({ start: 0, end: 0 });
  const insertionCaret = useRef<number | null>(null);

  function choose(emoji: string) {
    const start = Math.min(selection.current.start, draft.length);
    const end = Math.min(selection.current.end, draft.length);
    onChange(draft.slice(0, start) + emoji + draft.slice(end));
    insertionCaret.current = start + emoji.length;
    setOpen(false);
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(value) => {
        if (value) {
          const input = textareaRef.current;
          selection.current = {
            start: input?.selectionStart ?? draft.length,
            end: input?.selectionEnd ?? draft.length,
          };
          insertionCaret.current = null;
        }
        setOpen(value);
      }}
    >
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 rounded-full"
          disabled={disabled}
          aria-label="Ajouter un émoji"
          title="Ajouter un émoji"
        >
          <Smile aria-hidden="true" className="size-5" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={8}
          aria-label="Choisir un émoji"
          className="z-50 w-80 max-w-(--radix-popover-content-available-width) rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 duration-150 motion-reduce:animate-none"
          onCloseAutoFocus={(event) => {
            if (insertionCaret.current === null) return;
            event.preventDefault();
            const caret = insertionCaret.current;
            insertionCaret.current = null;
            requestAnimationFrame(() => {
              const input = textareaRef.current;
              if (!input?.isConnected) return;
              input.focus();
              input.setSelectionRange(caret, caret);
            });
          }}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Ajouter un émoji</p>
            <Popover.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Fermer le sélecteur d’émojis"
              >
                <X aria-hidden="true" className="size-4" />
              </Button>
            </Popover.Close>
          </div>
          <div className="max-h-64 space-y-3 overflow-y-auto overscroll-contain">
            {groups.map((group) => (
              <section key={group.name} aria-label={group.name}>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {group.name}
                </p>
                <div className="grid grid-cols-6 gap-1">
                  {group.emojis.map(([emoji, label]) => (
                    <Button
                      key={emoji}
                      type="button"
                      variant="ghost"
                      className="h-11 min-w-0 p-0 text-xl"
                      aria-label={label}
                      title={label}
                      onClick={() => choose(emoji)}
                    >
                      <span aria-hidden="true">{emoji}</span>
                    </Button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
