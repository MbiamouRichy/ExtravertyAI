import { Skeleton } from "@/components/ui/skeleton";
import { PageLoading } from "@/components/page-loading";
import {
  ConversationListLoading,
  ConversationMessagesLoading,
} from "@/components/dashboard/project/chat-loading-content";

// Miroir exact de WhatsappWorkspace (liste · conversation · fiche contact) :
// mêmes colonnes, bordures et hauteurs, pour un remplacement sans décalage.
export default function ChatLoading() {
  return (
    <PageLoading
      label="Chargement de la messagerie…"
      className="flex chat-viewport min-h-0 w-full flex-col overflow-hidden bg-background"
    >
      <div className="flex min-h-0 w-full flex-1 overflow-hidden">
        {/* Liste des conversations */}
        <div className="flex w-full min-h-0 shrink-0 flex-col overflow-hidden border-r bg-background md:w-64 lg:w-80 xl:w-[22rem]">
          <div className="space-y-2 border-b px-3 py-3">
            <div className="flex h-9 items-center gap-2 rounded-md border px-2.5">
              <Skeleton className="size-4 rounded-full" />
              <Skeleton className="h-3 w-36" />
            </div>
            <div className="flex items-start gap-1">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                {["w-14", "w-18", "w-14"].map((width, index) => (
                  <Skeleton
                    key={index}
                    className={`h-6 rounded-full ${width}`}
                  />
                ))}
              </div>
              <Skeleton className="size-6 rounded-full" />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden p-1.5">
            <ConversationListLoading />
          </div>
        </div>

        {/* Conversation active */}
        <div className="hidden min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex">
          {/* Colonne visible dès md : à 768 px, elle ne fait que 256 px de
              large. Mêmes variantes que l'en-tête réel (avatar dès lg,
              libellé de l'interrupteur dès xl, « Résoudre » en icône seule). */}
          <div className="flex shrink-0 items-center gap-3 border-b bg-background px-5 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden p-1">
              <Skeleton className="hidden size-9 shrink-0 rounded-full lg:block" />
              <div className="@container min-w-0 flex-1 space-y-1.5">
                <div className="flex min-w-0 items-center gap-2">
                  <Skeleton className="h-4 w-full max-w-36" />
                  <Skeleton className="size-5 shrink-0 rounded-full @max-[13rem]:hidden" />
                </div>
                <Skeleton className="h-4 w-full max-w-32 rounded-sm" />
              </div>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {/* Interrupteur « Assistant IA » */}
              <div className="flex h-8 shrink-0 items-center gap-2 rounded-lg border px-2.5">
                <Skeleton className="size-4 rounded-sm" />
                <Skeleton className="hidden h-3 w-20 xl:block" />
                <Skeleton className="h-3.5 w-6 rounded-full" />
              </div>
              {/* Résoudre · menu */}
              <Skeleton className="h-8 w-9 shrink-0 lg:w-24" />
              <Skeleton className="size-9 shrink-0" />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-size-[20px_20px] px-6 py-8">
            <Skeleton className="mx-auto mb-5 h-3 w-64 max-w-full" />
            <ConversationMessagesLoading />
          </div>

          <div className="shrink-0 bg-background px-5 pb-3 pt-4">
            <div className="mx-auto max-w-4xl">
              {/* Suggestions IA : le libellé se tronque, le bouton reste entier. */}
              <div className="mb-2 flex items-center justify-between gap-2">
                <Skeleton className="h-2.5 w-full max-w-24" />
                <Skeleton className="h-3 w-36 shrink-0" />
              </div>
              {/* Carte de saisie : bascule, texte, outils */}
              <div className="overflow-hidden rounded-xl border border-input shadow-xs">
                <div className="flex min-w-0 items-center gap-1 border-b px-1.5 py-1.5">
                  <Skeleton className="h-6 w-21 shrink-0" />
                  <Skeleton className="h-6 w-25 shrink-0" />
                </div>
                <div className="flex h-11 items-center px-3">
                  <Skeleton className="h-4 w-40 max-w-full" />
                </div>
                <div className="flex min-w-0 items-center gap-0.5 px-1.5 pb-1.5">
                  {[0, 1].map((index) => (
                    <div key={index} className="flex size-8 shrink-0 items-center justify-center">
                      <Skeleton className="size-4 rounded-full" />
                    </div>
                  ))}
                  {/* « Améliorer » */}
                  <div className="ml-0.5 flex h-8 shrink-0 items-center gap-1.5 px-2">
                    <Skeleton className="size-4 rounded-full" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  {/* Raccourci clavier : seulement s'il reste de la place. */}
                  <div className="ml-auto mr-1.5 hidden min-w-0 justify-end lg:flex">
                    <Skeleton className="h-3 w-40 max-w-full" />
                  </div>
                  <Skeleton className="size-8 shrink-0 rounded-lg max-lg:ml-auto" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fiche contact */}
        <div className="hidden w-80 shrink-0 flex-col gap-6 overflow-hidden border-l bg-background p-5 xl:flex">
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="size-16 rounded-full" />
            <Skeleton className="mt-1 h-5 w-32" />
            <Skeleton className="h-3 w-28" />
          </div>

          <div className="space-y-3 rounded-xl border p-4">
            <div className="space-y-1.5">
              <Skeleton className="h-2.5 w-28" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
            <div className="space-y-1.5 border-t pt-3">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-5 w-36 rounded-sm" />
              <Skeleton className="h-3 w-11/12" />
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <Skeleton className="h-3 w-16" />
              <div className="flex items-center gap-2">
                <Skeleton className="size-5 rounded-full" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border bg-muted/40 p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="mt-1 h-8 w-40 rounded-md" />
          </div>

          <div className="space-y-2">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-3 w-full" />
            <div className="flex gap-1.5">
              <Skeleton className="h-6 w-20 rounded-md" />
              <Skeleton className="h-6 w-16 rounded-md" />
            </div>
          </div>

          <div className="space-y-2">
            <Skeleton className="h-2.5 w-16" />
            <div className="divide-y rounded-xl border">
              {[0, 1].map((index) => (
                <div key={index} className="flex items-center justify-between px-3 py-3">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-14" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageLoading>
  );
}
