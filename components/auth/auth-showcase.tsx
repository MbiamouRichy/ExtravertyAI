import { Bot, Clock3, Sparkles } from "lucide-react";

const highlights = [
  { icon: Bot, title: "L’assistant répond pendant votre absence", meta: "24 h/24, 7 j/7" },
  { icon: Sparkles, title: "Instinct IA repère les prospects intéressants", meta: "Après chaque message" },
  { icon: Clock3, title: "Les contacts à relancer restent visibles", meta: "Rien ne se perd" },
];

/** Decorative product panel shared by the authentication screens. */
export function AuthShowcase({
  eyebrow = "Pendant votre absence",
  title = "Le matin, ouvrez d’abord les conversations qui comptent.",
}: {
  eyebrow?: string;
  title?: string;
}) {
  return (
    <aside
      aria-label="Ce que fait ExtravertyAI"
      className="relative isolate hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(var(--primary-foreground)_1px,transparent_1px)] opacity-10 mask-[radial-gradient(ellipse_at_top_right,black,transparent_70%)] bg-size-[20px_20px]"
      />
      <p className="font-mono text-xs uppercase tracking-[0.2em] opacity-60">{eyebrow}</p>

      <ul className="mx-auto w-full max-w-md space-y-3">
        {highlights.map(({ icon: Icon, title: label, meta }, index) => (
          <li
            key={label}
            className="flex items-center gap-4 rounded-2xl bg-primary-foreground/10 p-4 backdrop-blur motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-6 motion-safe:fill-mode-backwards motion-safe:duration-700"
            style={{ animationDelay: `${300 + index * 150}ms` }}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-foreground text-primary">
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-medium">{label}</span>
              <span className="block text-xs opacity-60">{meta}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="max-w-md font-heading text-2xl leading-snug">{title}</p>
    </aside>
  );
}
