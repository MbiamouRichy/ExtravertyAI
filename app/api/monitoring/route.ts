// Relais des erreurs du navigateur vers GlitchTip (voir lib/error-tracking/tunnel.ts).
// N’accepte que des enveloppes du projet configuré, de taille bornée, et ne
// les transmet qu’à l’hôte de ce projet : ce n’est pas un relais ouvert.
import { envelopeTarget, MAX_ENVELOPE_BYTES, parseDsn } from "@/lib/error-tracking/tunnel";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const configured = parseDsn(process.env.NEXT_PUBLIC_ERROR_TRACKING_DSN);
  // Suivi désactivé : on accuse réception sans rien transmettre.
  if (!configured) return new Response(null, { status: 204 });

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_ENVELOPE_BYTES) return new Response(null, { status: 413 });

  let body: Uint8Array;
  try {
    body = new Uint8Array(await request.arrayBuffer());
  } catch {
    return new Response(null, { status: 400 });
  }
  if (body.byteLength === 0) return new Response(null, { status: 400 });
  if (body.byteLength > MAX_ENVELOPE_BYTES) return new Response(null, { status: 413 });

  const target = envelopeTarget(body, configured);
  if (!target) return new Response(null, { status: 400 });

  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body: body as BodyInit,
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    });
    return new Response(null, { status: upstream.ok ? 200 : 502 });
  } catch {
    return new Response(null, { status: 502 });
  }
}
