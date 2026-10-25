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
    // Diffusions : jamais affichées dans un cadre (clickjacking), sans fuite
    // d’adresse vers d’autres sites, sans accès aux capteurs du navigateur.
    const hardened = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    return [
      { source: "/projects/:projectId/broadcasts", headers: hardened },
      { source: "/projects/:projectId/broadcasts/:path*", headers: hardened },
    ];
  },
};

export default nextConfig;
