import { type ApiData, CHAMBRES, type GroupeDetail } from "@clair/data";
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
export const alt = "Groupe politique sur CLAIR.vote";

type Params = Promise<{ chambre: string; slug: string }>;

/**
 * Image d'un groupe : sigle, nom complet, effectif et moyennes calculées par CLAIR (reprise de
 * apps/web). Composition courante : une image ne reçoit pas les paramètres de période de l'URL.
 */
const Image = async ({ params }: { params: Params }) => {
  const { chambre, slug } = await params;
  if (chambre !== "assemblee" && chambre !== "senat") return introuvable();
  const reponse = await chargerPourOg(() =>
    fetchResource<ApiData<GroupeDetail>>(`/groupes/${chambre}/${encodeURIComponent(slug)}`),
  );
  if (reponse === "absente") return introuvable();
  if (!reponse) {
    return imageOg(
      <OgPage
        badge="Groupes politiques"
        titre="Groupes politiques"
        sousTitre="Les groupes de l'Assemblée nationale et du Sénat : membres, votes et cohésion."
      />,
    );
  }
  const groupe = reponse.data;
  const couleur = groupe.couleur || OG_COULEURS.marque;
  return imageOg(
    <OgLayout badge={`Groupe politique · ${CHAMBRES[groupe.chambre].nom}`} badgeColor={couleur}>
      <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "16px",
            backgroundColor: couleur,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "32px",
            fontWeight: 700,
            color: OG_COULEURS.titre,
          }}
        >
          {groupe.nom.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
          <span style={{ fontSize: "48px", fontWeight: 700, lineHeight: 1.1 }}>{groupe.nom}</span>
          {groupe.nomComplet && groupe.nomComplet !== groupe.nom ? (
            <span style={{ fontSize: "24px", color: OG_COULEURS.mention }}>
              {groupe.nomComplet}
            </span>
          ) : null}
        </div>
      </div>
      <div style={{ display: "flex", gap: "16px", marginTop: "16px" }}>
        <OgStat label="Membres" value={ogNombre(groupe.membresActifsCount)} />
        <OgStat label="Présence moy." value={`${groupe.stats.presenceMoyenne} %`} />
        <OgStat label="Loyauté moy." value={`${groupe.stats.loyauteMoyenne} %`} />
      </div>
    </OgLayout>,
  );
};

export default Image;
