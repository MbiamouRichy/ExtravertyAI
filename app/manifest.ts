import type { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ExtravertyAI",
    short_name: "ExtravertyAI",
    description:
      "ExtravertyAI est un assistant de support client alimenté par IA qui fournit des réponses rapides et précises aux questions des clients, améliorant ainsi l'expérience client et le nombre de ventes.",
    start_url: "/",
    display: "standalone",
    background_color: "#fff",
    theme_color: "#fff",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      // Logo réduit à la zone sûre : Android peut découper l’icône en rond
      // ou en carré arrondi sans le rogner (scripts/generate-icons.ts).
      {
        src: "/maskable-icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}