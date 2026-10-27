import "server-only";
import type { Chambre } from "@clair/data";
import {
  chargerPourOg,
  imageOg,
  introuvable,
  OG_COULEURS,
  OgLayout,
  OgPage,
  OgStat,
  ogNombre,
  photoOg,
} from "@/lib/og.tsx";
import { chargerFiche } from "./chargement.ts";

const FONCTIONS: Record<Chambre, { F: string; M: string; rubrique: string }> = {
  assemblee: { F: "Députée", M: "Député", rubrique: "Députés" },
  senat: { F: "Sénatrice", M: "Sénateur", rubrique: "Sénateurs" },
};

/**
 * Image de partage d'une fiche de député ou de sénateur (reprise de apps/web) : photo, groupe,
 * circonscription et trois chiffres calculés par CLAIR. Slug inconnu : 404 ; API indisponible :
 * image de la rubrique.
 */
export const imageParlementaire = async (chambre: Chambre, slug: string) => {
  const reponse = await chargerPourOg(() => chargerFiche(chambre, slug));
  if (reponse === "absente") return introuvable();
  const fonctions = FONCTIONS[chambre];
  if (!reponse) {
    return imageOg(
      <OgPage
        badge={fonctions.rubrique}
        titre={fonctions.rubrique}
        sousTitre="Votes, présence et activité de chaque parlementaire."
      />,
    );
  }
  const fiche = reponse.data;
  const fonction = fonctions[fiche.sexe === "F" ? "F" : "M"];
  const badge = fiche.actif
    ? fonction
    : `${fiche.sexe === "F" ? "Ancienne" : "Ancien"} ${fonction.toLowerCase()}`;
  const photo = await photoOg(fiche.photoUrl);
  const stats = fiche.stats;

  return imageOg(
    <OgLayout badge={badge} badgeColor={fiche.groupe?.couleur || OG_COULEURS.marque}>
      <div style={{ display: "flex", alignItems: "center", gap: "40px" }}>
        {photo ? (
          <img
            src={photo}
            width={160}
            height={160}
            style={{ borderRadius: "50%", objectFit: "cover" }}
            alt=""
          />
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
          <span style={{ fontSize: "52px", fontWeight: 700, lineHeight: 1.1 }}>
            {`${fiche.prenom} ${fiche.nom}`}
          </span>
          {fiche.groupe ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "14px",
                  height: "14px",
                  borderRadius: "4px",
                  backgroundColor: fiche.groupe.couleur || OG_COULEURS.neutre,
                }}
              />
              <span style={{ fontSize: "28px", color: OG_COULEURS.texte }}>{fiche.groupe.nom}</span>
            </div>
          ) : null}
          {fiche.circonscription ? (
            <span style={{ fontSize: "24px", color: OG_COULEURS.mention }}>
              {`${fiche.circonscription.nom} (${fiche.circonscription.departement})`}
            </span>
          ) : null}
        </div>
      </div>
      {stats ? (
        <div style={{ display: "flex", gap: "16px", marginTop: "16px" }}>
          <OgStat label="Présence" value={`${stats.presence} %`} />
          <OgStat label="Loyauté" value={`${stats.loyaute} %`} />
          <OgStat label="Votes" value={ogNombre(stats.participation)} />
        </div>
      ) : null}
    </OgLayout>,
  );
};
