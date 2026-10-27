import { imageOg, OG_CONTENT_TYPE, OG_COULEURS, OG_SIZE, OgLayout } from "@/lib/og.tsx";

export const contentType = OG_CONTENT_TYPE;
export const size = OG_SIZE;
export const alt = "CLAIR.vote — Transparence politique en France";

/** Image de partage par défaut du site (reprise de apps/web). */
const Image = () =>
  imageOg(
    <OgLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <span style={{ fontSize: "72px", fontWeight: 700, color: OG_COULEURS.marque }}>
          CLAIR.vote
        </span>
        <span style={{ fontSize: "36px", color: OG_COULEURS.texte, lineHeight: 1.3 }}>
          Transparence politique en France
        </span>
        <span
          style={{
            fontSize: "24px",
            color: OG_COULEURS.mention,
            lineHeight: 1.5,
            maxWidth: "800px",
          }}
        >
          Votes, présence, loyauté des parlementaires. Lobbying, groupes politiques, classements.
          Données officielles, analysées pour les citoyens.
        </span>
      </div>
    </OgLayout>,
  );

export default Image;
