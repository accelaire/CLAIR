import { CHAMBRES, type DossierDetail } from "@clair/data";
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
} from "@/lib/og.tsx";

export const contentType = OG_CONTENT_TYPE;
export const size = OG_SIZE;
export const alt = "Dossier législatif sur CLAIR.vote";

/** État du dossier : un libellé, toujours écrit (la couleur n'est qu'un appoint). */
const ETATS: Record<string, { label: string; couleur: string }> = {
  en_cours: { label: "En cours", couleur: OG_COULEURS.info },
  adopte: { label: "Adopté", couleur: OG_COULEURS.succes },
  promulgue: { label: "Promulgué", couleur: OG_COULEURS.succes },
  rejete: { label: "Rejeté", couleur: OG_COULEURS.erreur },
  caduc: { label: "Caduc", couleur: OG_COULEURS.neutre },
  retire: { label: "Retiré", couleur: OG_COULEURS.neutre },
  fusionne: { label: "Fusionné", couleur: OG_COULEURS.avertissement },
};

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/** Image d'un dossier : état, titre, procédure et volumes (reprise de apps/web). */
const Image = async ({ params }: { params: Promise<{ uid: string }> }) => {
  const { uid } = await params;
  const dossier = await chargerPourOg(() =>
    fetchResource<DossierDetail>(`/dossiers/${encodeURIComponent(uid)}`),
  );
  if (dossier === "absente") return introuvable();
  if (!dossier) {
    return imageOg(
      <OgPage
        badge="Législation"
        badgeColor={OG_COULEURS.textes}
        titre="Dossiers législatifs"
        sousTitre="Projets et propositions de loi, de leur dépôt à leur promulgation."
      />,
    );
  }
  const etat = dossier.etat
    ? (ETATS[dossier.etat] ?? { label: dossier.etat, couleur: OG_COULEURS.neutre })
    : null;
  return imageOg(
    <OgLayout badge={`Dossier législatif · ${CHAMBRES[dossier.chambre].nom}`}>
      {etat ? (
        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            padding: "6px 16px",
            borderRadius: "8px",
            border: `2px solid ${etat.couleur}`,
            color: etat.couleur,
            fontSize: "22px",
            fontWeight: 700,
          }}
        >
          {etat.label}
        </div>
      ) : null}
      <span
        style={{
          fontSize: "44px",
          fontWeight: 700,
          lineHeight: 1.2,
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {dossier.titre}
      </span>
      <div style={{ display: "flex", gap: "24px", fontSize: "24px", color: OG_COULEURS.mention }}>
        {dossier.procedureLibelle ? <span>{dossier.procedureLibelle}</span> : null}
        {dossier.scrutinsCount > 0 ? (
          <span>{pluriel(dossier.scrutinsCount, "scrutin")}</span>
        ) : null}
        {dossier.amendementsCount > 0 ? (
          <span>{pluriel(dossier.amendementsCount, "amendement")}</span>
        ) : null}
      </div>
    </OgLayout>,
  );
};

export default Image;
