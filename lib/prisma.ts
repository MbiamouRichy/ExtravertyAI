import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Vercel gèle ses fonctions : une connexion restée au pool peut être morte au
// réveil, et une requête posée dessus attendrait la coupure de la fonction.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ...(process.env.VERCEL && {
    // Chaque fonction garde son pool, même gelée : à 10 connexions par défaut,
    // une dizaine d’instances suffit à saturer les 100 places de la base.
    max: 3,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    keepAlive: true,
    maxLifetimeSeconds: 60,
    query_timeout: 15_000,
  }),
});

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
