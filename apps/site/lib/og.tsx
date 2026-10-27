import "server-only";
import { chartPalette, colors, palette } from "@clair/theme/tokens";
import { ImageResponse } from "next/og";
import type { ReactNode } from "react";

/**
 * Images de partage (Open Graph), reprises de `lib/og.tsx` de apps/web : fond sombre, marque
 * CLAIR.vote, un badge de rubrique, le titre et quelques chiffres.
 *
 * Satori (le moteur de `next/og`) ne lit pas les variables CSS : les couleurs viennent des
 * tokens de `@clair/theme` (thème sombre), jamais de valeurs écrites ici.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const sombre = colors.sombre;

/** Couleurs des images, toutes issues des tokens. */
export const OG_COULEURS = {
  marque: sombre["texte-action"],
  titre: sombre["texte-titre"],
  texte: palette["ardoise-200"],
  mention: sombre["texte-mention"],
  pastille: sombre["fond-neutre"],
  neutre: sombre["statut-neutre"],
  scrutins: chartPalette[0],
  textes: chartPalette[1],
  agenda: sombre["statut-succes"],
  lobbying: sombre["statut-avertissement"],
  succes: sombre["statut-succes"],
  erreur: sombre["statut-erreur"],
  info: sombre["statut-info"],
  avertissement: sombre["statut-avertissement"],
} as const;

/**
 * Inter 600, la police de apps/web, chargée une fois par processus depuis jsDelivr (Satori ne lit
 * ni le woff2 ni la police variable de `@fontsource-variable/inter`). Échec ou délai dépassé :
 * `null`, et l'image se dessine avec la police intégrée à `next/og` plutôt que de ne pas se
 * dessiner du tout.
 */
const FONT_URL =
  "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.1.1/files/inter-latin-600-normal.woff";

let police: Promise<ArrayBuffer | null> | null = null;

const chargerPolice = () => {
  police ??= fetch(FONT_URL, { signal: AbortSignal.timeout(3000) })
    .then((reponse) => (reponse.ok ? reponse.arrayBuffer() : null))
    .catch(() => null)
    .then((donnees) => {
      if (!donnees) police = null;
      return donnees;
    });
  return police;
};

/** Rend une image de partage aux dimensions Open Graph. */
export const imageOg = async (contenu: ReactNode) => {
  const donnees = await chargerPolice();
  return new ImageResponse(contenu, {
    ...OG_SIZE,
    ...(donnees ? { fonts: [{ name: "Inter", data: donnees, weight: 600 as const }] } : {}),
  });
};

/**
 * Photo d'un élu en `data:` URL, ou `null`. Satori échoue sur une image injoignable : la photo
 * est donc chargée à part, avec un délai, et simplement omise si le site de la chambre ne répond
 * pas.
 */
export const photoOg = async (url: string | null) => {
  if (!url?.startsWith("https://")) return null;
  try {
    const reponse = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const type = reponse.headers.get("content-type") ?? "";
    if (!reponse.ok || !type.startsWith("image/")) return null;
    const octets = Buffer.from(await reponse.arrayBuffer());
    return `data:${type};base64,${octets.toString("base64")}`;
  } catch {
    return null;
  }
};

/**
 * Nombre en français. L'espace fine insécable de `Intl` (U+202F) n'est pas garantie dans la seule
 * graisse embarquée : une espace ordinaire se dessine toujours.
 */
export const ogNombre = (n: number) => n.toLocaleString("fr-FR").replace(/[  ]/g, " ");

/** Gabarit commun : badge en haut, contenu au centre, marque en bas. */
export const OgLayout = ({
  children,
  badge,
  badgeColor = OG_COULEURS.marque,
}: {
  children: ReactNode;
  badge?: string;
  badgeColor?: string;
}) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: "60px 64px",
      background: `linear-gradient(145deg, ${palette["nuit-950"]} 0%, ${palette["nuit-800"]} 100%)`,
      color: OG_COULEURS.titre,
      fontFamily: "Inter, sans-serif",
    }}
  >
    {badge ? (
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
        <div
          style={{
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            backgroundColor: badgeColor,
          }}
        />
        <span
          style={{
            fontSize: "22px",
            color: OG_COULEURS.mention,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {badge}
        </span>
      </div>
    ) : null}
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        justifyContent: "center",
        gap: "16px",
      }}
    >
      {children}
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
      <span style={{ fontSize: "20px", color: OG_COULEURS.mention }}>
        Transparence politique en France
      </span>
      <span style={{ fontSize: "28px", fontWeight: 700, color: OG_COULEURS.marque }}>
        CLAIR.vote
      </span>
    </div>
  </div>
);

/** Chiffre en pastille (« Présence 92 % »). */
export const OgStat = ({ label, value }: { label: string; value: string }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "8px 16px",
      borderRadius: "8px",
      backgroundColor: OG_COULEURS.pastille,
    }}
  >
    <span style={{ fontSize: "20px", color: OG_COULEURS.mention }}>{label}</span>
    <span style={{ fontSize: "22px", fontWeight: 700 }}>{value}</span>
  </div>
);

/**
 * Image d'une page de rubrique, sans appel à l'API : elle se génère même quand l'API ne répond
 * pas. Sert aussi de repli aux fiches dont l'API est momentanément indisponible.
 */
export const OgPage = ({
  badge,
  badgeColor,
  titre,
  sousTitre,
  stats,
}: {
  badge: string;
  badgeColor?: string;
  titre: string;
  sousTitre: string;
  stats?: { label: string; value: string }[];
}) => (
  <OgLayout badge={badge} badgeColor={badgeColor}>
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <span style={{ fontSize: "64px", fontWeight: 700, lineHeight: 1.15 }}>{titre}</span>
      <span
        style={{ fontSize: "32px", color: OG_COULEURS.texte, lineHeight: 1.3, maxWidth: "900px" }}
      >
        {sousTitre}
      </span>
      {stats && stats.length > 0 ? (
        <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
          {stats.map((s) => (
            <OgStat key={s.label} label={s.label} value={s.value} />
          ))}
        </div>
      ) : null}
    </div>
  </OgLayout>
);

/** Rubrique d'une page de rubrique (export par défaut d'un `opengraph-image.tsx`). */
export const imageRubrique = (props: Parameters<typeof OgPage>[0]) => () =>
  imageOg(<OgPage {...props} />);

/**
 * Charge la ressource d'une fiche : `"absente"` sur un 404 de l'API (l'image répond 404), `null`
 * si l'API est indisponible (l'image se replie sur celle de la rubrique).
 */
export const chargerPourOg = async <T,>(charger: () => Promise<T | null>) => {
  try {
    return (await charger()) ?? "absente";
  } catch (error) {
    console.error("[og] API indisponible, image de repli", error);
    return null;
  }
};

export const introuvable = () => new Response("Introuvable", { status: 404 });
