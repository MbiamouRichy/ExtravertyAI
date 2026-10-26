import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "storage.efferd.com",
        port: "",
        pathname: "/screen/**",
        search: "",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
  async headers() {
    // Toute l’application : jamais dans un cadre (clickjacking sur les boutons
    // de suppression ou de paiement), type MIME respecté, adresse limitée
    // vers les autres sites. Le micro reste permis à l’app (notes vocales).
    const baseline = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    ];
    // Diffusions : jamais affichées dans un cadre (clickjacking), sans fuite
    // d’adresse vers d’autres sites, sans accès aux capteurs du navigateur.
    // Déclarées après la base : elles la remplacent sur ces chemins.
    const hardened = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    return [
      { source: "/:path*", headers: baseline },
      { source: "/projects/:projectId/broadcasts", headers: hardened },
      { source: "/projects/:projectId/broadcasts/:path*", headers: hardened },
    ];
  },
};

export default nextConfig;
