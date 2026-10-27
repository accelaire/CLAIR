import type { SujetDetail } from "@clair/data";
import { fetchResource } from "@/lib/api-server.ts";
import {
  chargerPourOg,
  imageOg,
  introuvable,
  OG_CONTENT_TYPE,
  OG_COULEURS,
  OG_SIZE,
  OgLayout,
  OgPage,
  OgStat,
  ogNombre,
} from "@/lib/og.tsx";

export const contentType = OG_CONTENT_TYPE;
export const size = OG_SIZE;
export const alt = "Sujet politique sur CLAIR.vote";

/** Image d'un sujet : libellé, description et volumes (reprise de apps/web). */
const Image = async ({ params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;
  const reponse = await chargerPourOg(() =>
    fetchResource<{ data: SujetDetail }>(`/sujets/${encodeURIComponent(slug)}`),
  );
  if (reponse === "absente") return introuvable();
  if (!reponse) {
    return imageOg(
      <OgPage
        badge="Sujets"
        badgeColor={OG_COULEURS.textes}
        titre="Sujets politiques"
        sousTitre="Les grands sujets du débat parlementaire, dossier par dossier."
      />,
    );
  }
  const sujet = reponse.data;
  return imageOg(
    <OgLayout
      badge={sujet.category ? `Sujet · ${sujet.category}` : "Sujet politique"}
      badgeColor={OG_COULEURS.textes}
    >
      <span style={{ fontSize: "56px", fontWeight: 700, lineHeight: 1.15 }}>{sujet.label}</span>
      {sujet.description ? (
        <span
          style={{
            fontSize: "26px",
            color: OG_COULEURS.texte,
            lineHeight: 1.4,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {sujet.description}
        </span>
      ) : null}
      <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
        <OgStat label="Dossiers" value={ogNombre(sujet.dossierCount)} />
        <OgStat label="Scrutins" value={ogNombre(sujet.scrutinCount)} />
      </div>
    </OgLayout>,
  );
};

export default Image;
