import type { ScrutinDetail } from "@clair/data";
import { parseScrutinFicheParams, scrutinApiQuery } from "@clair/screens";
import { voteChartColors } from "@clair/theme/tokens";
import { fetchResource } from "@/lib/api-server.ts";
import {
  chargerPourOg,
  imageOg,
  introuvable,
  OG_COULEURS,
  OgLayout,
  OgPage,
  ogNombre,
} from "@/lib/og.tsx";

export const runtime = "nodejs";

/**
 * Image de partage d'un scrutin : titre, barre de votes et résultat (reprise de
 * `app/scrutins/[numero]/og/route.tsx` de apps/web).
 *
 * Route et non fichier `opengraph-image.tsx` : le numéro d'un scrutin n'est unique dans aucune
 * chambre, il faut la chambre et la session pour le retrouver, et un `opengraph-image` ne reçoit
 * pas les paramètres de l'adresse. La page annonce cette image avec `chambre`, `session` et `v`
 * (`OG_SCRUTIN_VERSION`, page.tsx).
 */

type ScrutinOg = Pick<
  ScrutinDetail,
  | "numero"
  | "chambre"
  | "titre"
  | "date"
  | "sort"
  | "nombrePour"
  | "nombreContre"
  | "nombreAbstention"
>;

/** `sort` brut de l'API : `adopte` ou `rejete`, sans accent (comme `isScrutinAdopte` de apps/web). */
const estAdopte = (sort: string | null | undefined) =>
  (sort ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() === "adopte";

/** Barre pour / contre / abstention ; les chiffres sont écrits à côté (jamais la couleur seule). */
const BarreVotes = ({
  pour,
  contre,
  abstention,
}: Record<"pour" | "contre" | "abstention", number>) => {
  const total = pour + contre + abstention || 1;
  const parts = [
    { cle: "pour", n: pour, couleur: voteChartColors.pour },
    { cle: "contre", n: contre, couleur: voteChartColors.contre },
    { cle: "abstention", n: abstention, couleur: voteChartColors.abstention },
  ];
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "32px",
        borderRadius: "16px",
        overflow: "hidden",
        backgroundColor: OG_COULEURS.pastille,
      }}
    >
      {parts.map((part) => (
        <div
          key={part.cle}
          style={{
            display: "flex",
            width: `${(part.n / total) * 100}%`,
            backgroundColor: part.couleur,
          }}
        />
      ))}
    </div>
  );
};

const repli = () =>
  imageOg(
    <OgPage
      badge="Scrutins"
      badgeColor={OG_COULEURS.scrutins}
      titre="Scrutins publics"
      sousTitre="Les votes de l'Assemblée nationale et du Sénat, scrutin par scrutin."
    />,
  );

export const GET = async (
  requete: Request,
  { params }: { params: Promise<{ numero: string }> },
) => {
  const { numero } = await params;
  if (!/^\d{1,6}$/.test(numero) || Number(numero) <= 0) return introuvable();
  const recherche = new URL(requete.url).searchParams;
  const query = scrutinApiQuery(
    parseScrutinFicheParams({
      chambre: recherche.get("chambre") ?? undefined,
      session: recherche.get("session") ?? undefined,
    }),
  );
  const reponse = await chargerPourOg(() =>
    fetchResource<{ data: ScrutinOg }>(`/scrutins/${numero}`, query),
  );
  if (reponse === "absente" || (reponse && !reponse.data)) return introuvable();
  const scrutin = reponse?.data;
  if (!scrutin) return repli();

  const chambre = scrutin.chambre === "senat" ? "Sénat" : "Assemblée nationale";
  const adopte = estAdopte(scrutin.sort);
  const couleurResultat = adopte ? OG_COULEURS.succes : OG_COULEURS.erreur;
  const date = new Date(scrutin.date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });

  const image = await imageOg(
    <OgLayout badge={`Scrutin n°${scrutin.numero} · ${chambre}`} badgeColor={OG_COULEURS.scrutins}>
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
        {scrutin.titre}
      </span>
      <BarreVotes
        pour={scrutin.nombrePour}
        contre={scrutin.nombreContre}
        abstention={scrutin.nombreAbstention}
      />
      <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
        <div
          style={{
            display: "flex",
            padding: "6px 18px",
            borderRadius: "8px",
            border: `2px solid ${couleurResultat}`,
            color: couleurResultat,
            fontSize: "28px",
            fontWeight: 700,
          }}
        >
          {adopte ? "Adopté" : "Rejeté"}
        </div>
        <span style={{ fontSize: "22px", color: OG_COULEURS.texte }}>
          {ogNombre(scrutin.nombrePour)} pour · {ogNombre(scrutin.nombreContre)} contre ·{" "}
          {ogNombre(scrutin.nombreAbstention)} abstentions
        </span>
        <span style={{ fontSize: "20px", color: OG_COULEURS.mention, marginLeft: "auto" }}>
          {date}
        </span>
      </div>
    </OgLayout>,
  );
  // Le rendu d'une carte peut être faux et corrigé ensuite : cache long mais révocable, jamais
  // `immutable` (défaut de `ImageResponse`), comme apps/web.
  image.headers.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=604800");
  return image;
};
