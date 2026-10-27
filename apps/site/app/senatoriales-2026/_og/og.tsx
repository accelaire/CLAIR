import "server-only";
import { ImageResponse } from "next/og";
import type { ReactElement, ReactNode } from "react";

/**
 * Habillage des images Open Graph de la rubrique, repris de `lib/og.tsx` de apps/web pour que
 * l'aperçu partagé reste le même. Satori ne connaît ni les variables CSS ni le thème : les
 * couleurs sont écrites ici, celles de apps/web, et ne servent qu'aux images.
 */
export const OG_SIZE = { width: 1200, height: 630 };

const FONT_URL =
  "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.1.1/files/inter-latin-600-normal.woff";

let fontCache: ArrayBuffer | null = null;

/**
 * Inter 600, comme apps/web. Si le CDN ne répond pas (cinq secondes au plus), l'image est faite
 * avec la police par défaut de Satori plutôt que de ne pas être faite du tout.
 */
const loadFont = async (): Promise<ArrayBuffer | null> => {
  if (fontCache) return fontCache;
  try {
    const reponse = await fetch(FONT_URL, { signal: AbortSignal.timeout(5000) });
    if (!reponse.ok) return null;
    fontCache = await reponse.arrayBuffer();
    return fontCache;
  } catch {
    return null;
  }
};

/** Rendu d'une image OG avec la police de la rubrique quand elle est disponible. */
export const imageOg = async (contenu: ReactElement): Promise<ImageResponse> => {
  const font = await loadFont();
  return new ImageResponse(contenu, {
    ...OG_SIZE,
    ...(font ? { fonts: [{ name: "Inter", data: font, weight: 600 as const }] } : {}),
  });
};

/** Fond sombre et bandeau CLAIR.vote. */
export const OgLayout = ({
  children,
  badge,
  badgeColor = "#3b82f6",
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
      background: "linear-gradient(145deg, #0c1222 0%, #162032 100%)",
      color: "white",
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
            color: "#94a3b8",
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
      <span style={{ fontSize: "20px", color: "#475569" }}>Transparence politique en France</span>
      <span style={{ fontSize: "28px", fontWeight: 700, color: "#3b82f6" }}>CLAIR.vote</span>
    </div>
  </div>
);

/** Nombre en français, avec une espace ordinaire (l'insécable étroite peut manquer à la police). */
export const ogNombre = (n: number): string => n.toLocaleString("fr-FR").replace(/[  ]/g, " ");

const OgStat = ({ label, value }: { label: string; value: string }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "8px 16px",
      borderRadius: "8px",
      backgroundColor: "rgba(255,255,255,0.08)",
    }}
  >
    <span style={{ fontSize: "20px", color: "#94a3b8" }}>{label}</span>
    <span style={{ fontSize: "22px", fontWeight: 700 }}>{value}</span>
  </div>
);

/** Visuel d'une page de rubrique : surtitre, titre, sous-titre et pastilles de chiffres. */
export const OgPage = ({
  badge,
  badgeColor,
  surtitre,
  titre,
  sousTitre,
  stats,
}: {
  badge: string;
  badgeColor?: string;
  surtitre?: string;
  titre: string;
  sousTitre: string;
  stats?: { label: string; value: string }[];
}) => (
  <OgLayout badge={badge} badgeColor={badgeColor}>
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {surtitre ? (
        <span style={{ fontSize: "28px", color: badgeColor ?? "#3b82f6" }}>{surtitre}</span>
      ) : null}
      <span style={{ fontSize: "64px", fontWeight: 700, color: "#f8fafc", lineHeight: 1.15 }}>
        {titre}
      </span>
      <span style={{ fontSize: "32px", color: "#e2e8f0", lineHeight: 1.3, maxWidth: "900px" }}>
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
