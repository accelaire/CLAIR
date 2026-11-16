import {
  type ApiData,
  type GroupeClasse,
  nonClasse,
  type PageMeta,
  type ParlementaireListItem,
  presenceDe,
  type RangClassement,
} from "@clair/data";
import { CLASSEMENT_PAR_PAGE, type CritereGroupe, parseClassementsParams } from "@clair/screens";
import type { ReactNode } from "react";
import { fetchResource } from "@/lib/api-server.ts";
import {
  chargerPourOg,
  imageOg,
  OG_COULEURS,
  OgLayout,
  OgPage,
  OgStat,
  ogNombre,
  photoOg,
} from "@/lib/og.tsx";

export const runtime = "nodejs";

/**
 * Image de partage des classements, reprise de `/api/og?type=classement…` de apps/web : top 5 du
 * critère, top 5 des groupes, ou carte du parlementaire mis en avant avec son rang. La page
 * l'annonce avec ses propres paramètres (`queryImageClassements`, `lib/og-classements.ts`).
 *
 * Présence (#108) : au Sénat, la présence aux votes solennels (`presenceDe`), jamais le taux tous
 * scrutins ; un taux absent s'écrit « — », un élu sous 50 scrutins est « non classé ».
 */

type Critere = "presence" | "loyaute" | "amendements" | "interventions";

const CRITERES: Record<Critere, string> = {
  presence: "Présence",
  loyaute: "Loyauté",
  amendements: "Amendements",
  interventions: "Interventions",
};

const CRITERES_GROUPE: Record<CritereGroupe, string> = {
  presence: "Présence",
  loyaute: "Loyauté",
  cohesion: "Cohésion",
  membres: "Membres",
};

const CHAMBRES = { assemblee: "Assemblée nationale", senat: "Sénat", "": "Toutes chambres" };

/** « 73 % », ou « — » sans valeur : jamais « null % ». Espace simple, couverte par la police de l'image. */
const pourcentOg = (valeur: number | null | undefined) =>
  valeur === null || valeur === undefined ? "—" : `${valeur} %`;

/** Libellé de la présence : solennels au Sénat, présence (taux de participation) à l'Assemblée. */
const libellePresence = (chambre: string) =>
  chambre === "senat" ? "Présence (solennels)" : "Présence";

const valeurCritere = (item: ParlementaireListItem, critere: Critere): string => {
  if (!item.stats) return "—";
  if (critere === "presence") return pourcentOg(presenceDe(item.chambre, item.stats));
  if (critere === "loyaute") return pourcentOg(item.stats.loyaute);
  const nombre = item.stats[critere];
  return nombre === null ? "—" : ogNombre(nombre);
};

const valeurGroupe = (groupe: GroupeClasse, critere: CritereGroupe) => {
  switch (critere) {
    case "presence":
      return groupe.chambre === "senat"
        ? groupe.statsPresenceSolennelMoyenne
        : groupe.statsPresenceMoyenne;
    case "loyaute":
      return groupe.statsLoyauteMoyenne;
    case "cohesion":
      return groupe.statsCohesion;
    case "membres":
      return groupe.membresActifsCount;
  }
};

/** Ligne d'un top 5 : rang, pastille ou photo, nom, valeur. */
const Ligne = ({
  rang,
  visuel,
  nom,
  valeur,
}: {
  rang: number;
  visuel: ReactNode;
  nom: string;
  valeur: string;
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "16px",
      padding: "8px 16px",
      borderRadius: "12px",
      backgroundColor: OG_COULEURS.pastille,
    }}
  >
    <span style={{ fontSize: "24px", fontWeight: 700, color: OG_COULEURS.mention, width: "32px" }}>
      {String(rang)}
    </span>
    {visuel}
    <span style={{ fontSize: "22px", fontWeight: 600, flex: 1 }}>{nom}</span>
    <span style={{ fontSize: "22px", fontWeight: 700, color: OG_COULEURS.marque }}>{valeur}</span>
  </div>
);

const Liste = ({
  badge,
  titre,
  chambre,
  children,
}: {
  badge: string;
  titre: string;
  chambre: string;
  children: ReactNode;
}) => (
  <OgLayout badge={badge} badgeColor={OG_COULEURS.marque}>
    <span style={{ fontSize: "44px", fontWeight: 700, lineHeight: 1.2 }}>{titre}</span>
    <span style={{ fontSize: "24px", color: OG_COULEURS.mention }}>{chambre}</span>
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
      {children}
    </div>
  </OgLayout>
);

const repli = () =>
  imageOg(
    <OgPage
      badge="Classements"
      titre="Classements"
      sousTitre="Présence, loyauté et activité des parlementaires et des groupes, calculées par CLAIR."
    />,
  );

type Params = ReturnType<typeof parseClassementsParams>;

const imageGroupes = async (params: Params) => {
  const reponse = await chargerPourOg(() =>
    fetchResource<ApiData<GroupeClasse[]>>(
      "/groupes",
      params.chambre ? { chambre: params.chambre } : {},
    ),
  );
  if (!reponse || reponse === "absente") return repli();
  const critere = params.groupeSort;
  const groupes = reponse.data
    .filter((groupe) => groupe.membresActifsCount > 0)
    .sort((a, b) => (valeurGroupe(b, critere) ?? -1) - (valeurGroupe(a, critere) ?? -1))
    .slice(0, 5);
  const label = CRITERES_GROUPE[critere];
  return imageOg(
    <Liste
      badge={`Classement groupes · ${label}`}
      titre={`Groupes politiques par ${label.toLowerCase()}`}
      chambre={CHAMBRES[params.chambre]}
    >
      {groupes.map((groupe, index) => {
        const valeur = valeurGroupe(groupe, critere);
        return (
          <Ligne
            key={groupe.slug}
            rang={index + 1}
            nom={groupe.nom}
            valeur={critere === "membres" ? ogNombre(valeur ?? 0) : pourcentOg(valeur)}
            visuel={
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "6px",
                  backgroundColor: groupe.couleur || OG_COULEURS.neutre,
                }}
              />
            }
          />
        );
      })}
    </Liste>,
  );
};

const listeQuery = (params: Params, critere: Critere, page: number, limit: number) => ({
  ...(params.chambre ? { chambre: params.chambre } : {}),
  sort: critere,
  order: "desc",
  periode: params.periode,
  page: String(page),
  limit: String(limit),
});

const imageTop = async (params: Params, critere: Critere) => {
  const reponse = await chargerPourOg(() =>
    fetchResource<PageMeta<ParlementaireListItem>>(
      "/parlementaires",
      listeQuery(params, critere, 1, 5),
    ),
  );
  if (!reponse || reponse === "absente") return repli();
  const top = reponse.data.slice(0, 5);
  const photos = await Promise.all(top.map((item) => photoOg(item.photoUrl)));
  const label = CRITERES[critere];
  return imageOg(
    <Liste
      badge={`Classement · ${label}`}
      titre={`Classement par ${label.toLowerCase()}`}
      chambre={CHAMBRES[params.chambre]}
    >
      {top.map((item, index) => {
        const photo = photos[index];
        return (
          <Ligne
            key={item.slug}
            rang={index + 1}
            nom={`${item.prenom} ${item.nom}`}
            valeur={valeurCritere(item, critere)}
            visuel={
              photo ? (
                <img
                  src={photo}
                  width={40}
                  height={40}
                  style={{ borderRadius: "50%", objectFit: "cover" }}
                  alt=""
                />
              ) : null
            }
          />
        );
      })}
    </Liste>,
  );
};

/** Rang du parlementaire mis en avant quand l'adresse ne le donne pas ; `null` si inconnu. */
const rangDe = async (params: Params, critere: Critere) => {
  const reponse = await chargerPourOg(() =>
    fetchResource<ApiData<RangClassement>>(
      `/parlementaires/${encodeURIComponent(params.highlight)}/rank`,
      {
        sort: critere,
        order: "desc",
        periode: params.periode,
        ...(params.chambre ? { chambre: params.chambre } : {}),
      },
    ),
  );
  return reponse && reponse !== "absente" ? reponse.data.rank : null;
};

/**
 * Parlementaire mis en avant :la ligne du classement affiché (même période, même chambre), lue
 * sur la page de son rang. Sans rang ou introuvable sur cette page : le top 5 du critère.
 */
const imageMiseEnAvant = async (params: Params, critere: Critere) => {
  const slug = params.highlight;
  const rangConnu = params.rank ?? (await rangDe(params, critere));
  if (!rangConnu) return imageTop(params, critere);
  const page = Math.ceil(rangConnu / CLASSEMENT_PAR_PAGE);
  const reponse = await chargerPourOg(() =>
    fetchResource<PageMeta<ParlementaireListItem>>(
      "/parlementaires",
      listeQuery(params, critere, page, CLASSEMENT_PAR_PAGE),
    ),
  );
  const item =
    reponse && reponse !== "absente" ? reponse.data.find((ligne) => ligne.slug === slug) : null;
  if (!item) return imageTop(params, critere);

  const label = CRITERES[critere];
  const badge = nonClasse(item.chambre, item.stats, critere)
    ? `Non classé en ${label.toLowerCase()}`
    : `#${rangConnu} en ${label.toLowerCase()}`;
  const photo = await photoOg(item.photoUrl);
  return imageOg(
    <OgLayout badge={badge} badgeColor={item.groupe?.couleur || OG_COULEURS.marque}>
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
            {`${item.prenom} ${item.nom}`}
          </span>
          {item.groupe ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "14px",
                  height: "14px",
                  borderRadius: "4px",
                  backgroundColor: item.groupe.couleur || OG_COULEURS.neutre,
                }}
              />
              <span style={{ fontSize: "28px", color: OG_COULEURS.texte }}>{item.groupe.nom}</span>
            </div>
          ) : null}
        </div>
      </div>
      <div style={{ display: "flex", gap: "16px", marginTop: "16px" }}>
        {critere === "presence" || critere === "loyaute" ? null : (
          <OgStat label={label} value={valeurCritere(item, critere)} />
        )}
        <OgStat label={libellePresence(item.chambre)} value={valeurCritere(item, "presence")} />
        <OgStat label="Loyauté" value={valeurCritere(item, "loyaute")} />
      </div>
    </OgLayout>,
  );
};

export const GET = async (requete: Request) => {
  const recherche = new URL(requete.url).searchParams;
  const params = parseClassementsParams(Object.fromEntries(recherche));
  let image: Response;
  if (params.tab === "groupes") image = await imageGroupes(params);
  else if (params.sort === "nom") image = await repli();
  else if (params.highlight) image = await imageMiseEnAvant(params, params.sort);
  else image = await imageTop(params, params.sort);
  // Classements recalculés chaque jour : cache d'une heure, révocable (jamais `immutable`).
  image.headers.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  return image;
};
