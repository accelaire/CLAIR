/**
 * Proxy same-origin vers l'API CLAIR : segments en liste blanche, chemin exact relayé, secret
 * interne et IP du visiteur, cache edge. La logique et ses tests : `lib/api-proxy.ts`.
 */
import type { NextRequest } from "next/server";
import { relayerVersApi } from "@/lib/api-proxy.ts";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path: string[] }> };

export const GET = async (request: NextRequest, { params }: Context) =>
  relayerVersApi(request, (await params).path);
export const HEAD = GET;
export const POST = GET;
