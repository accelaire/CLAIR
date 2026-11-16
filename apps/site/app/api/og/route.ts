import { depuisAncienneImage } from "@/lib/og-classements.ts";

/**
 * Anciennes images des classements de apps/web (`/api/og?type=classement…`), déjà partagées sur
 * les réseaux : redirection permanente vers l'image des classements (`/classements/og`).
 */
export const GET = (requete: Request) => {
  const url = new URL(requete.url);
  const query = depuisAncienneImage(url.searchParams);
  if (query === null) return new Response("Introuvable", { status: 404 });
  return Response.redirect(new URL(`/classements/og?${query}`, url), 308);
};
