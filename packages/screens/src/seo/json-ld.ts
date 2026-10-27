/**
 * Données structurées schema.org (JSON-LD) des pages du site, reprises de
 * `components/seo/JsonLd.tsx` de apps/web.
 *
 * Fonctions pures : la route les appelle avec l'adresse publique du site et ses données, puis
 * rend le résultat dans une balise `<script type="application/ld+json">` (`serialiserJsonLd`).
 * Elles ne décrivent que ce que la page affiche déjà : jamais de contenu réservé aux moteurs.
 */
import { type Chambre, estAdopte, type ParlementaireDetail } from "@clair/data";
import { fonctionDe } from "../shared/parlementaires/chambre.ts";

export type JsonLd = Record<string, unknown>;

const CONTEXTE = "https://schema.org";
const NOM_DU_SITE = "CLAIR.vote";
const NOM_LONG = "Citoyen Libre, Analyse, Information, République";

/** Adresse absolue : `https://clair.vote` + `/deputes`. */
const absolu = (base: string, chemin: string) => `${base.replace(/\/$/, "")}${chemin}`;

/** Première lettre en capitale : « ancien député » → « Ancien député ». */
const capitale = (texte: string) => `${texte.charAt(0).toUpperCase()}${texte.slice(1)}`;

/**
 * Texte d'une balise `<script>` : JSON dont `<`, `>` et `&` sont échappés, pour qu'une donnée
 * contenant `</script>` (titre, nom d'organisation) ne puisse pas fermer la balise.
 */
export const serialiserJsonLd = (data: JsonLd) =>
  JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

/** L'association qui édite le site (layout). */
export const organisationJsonLd = (base: string): JsonLd => ({
  "@context": CONTEXTE,
  "@type": "Organization",
  name: NOM_DU_SITE,
  alternateName: NOM_LONG,
  url: base,
  logo: absolu(base, "/icon.png"),
  description:
    "Plateforme citoyenne de transparence politique en France. Analysez les votes des parlementaires, le lobbying et les activités politiques.",
  foundingDate: "2025",
  sameAs: [],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    url: absolu(base, "/soutenir"),
  },
});

/** Le site et sa recherche (layout). */
export const siteWebJsonLd = (base: string): JsonLd => ({
  "@context": CONTEXTE,
  "@type": "WebSite",
  name: NOM_DU_SITE,
  alternateName: NOM_LONG,
  url: base,
  description:
    "CLAIR.vote : analysez les votes des députés et sénateurs, suivez le lobbying et la transparence politique en France.",
  inLanguage: "fr-FR",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: absolu(base, "/recherche?q={search_term_string}"),
    },
    "query-input": "required name=search_term_string",
  },
});

export type MaillonFil = { nom: string; chemin: string };

/** Fil d'Ariane ; l'accueil est ajouté en tête. Chemins relatifs à la racine du site. */
export const filArianeJsonLd = (base: string, maillons: MaillonFil[]): JsonLd => ({
  "@context": CONTEXTE,
  "@type": "BreadcrumbList",
  itemListElement: [{ nom: "Accueil", chemin: "" }, ...maillons].map((maillon, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: maillon.nom,
    item: maillon.chemin ? absolu(base, maillon.chemin) : base,
  })),
});

const CHEMIN_CHAMBRE: Record<Chambre, string> = { assemblee: "/deputes", senat: "/senateurs" };

/**
 * Un parlementaire (`Person`). Pour un ancien élu, ni `jobTitle` ni `worksFor` : dans schema.org
 * ils décrivent l'emploi actuel ; le mandat passé reste dit dans `description`.
 */
export const parlementaireJsonLd = (
  base: string,
  fiche: ParlementaireDetail,
  chambre: Chambre,
): JsonLd => {
  const fonction = fonctionDe(chambre, fiche.sexe, fiche.actif);
  const sameAs = [
    fiche.twitter ? `https://x.com/${fiche.twitter.replace("@", "")}` : null,
    fiche.facebook,
    fiche.siteWeb,
  ].filter((lien): lien is string => Boolean(lien));
  const data: JsonLd = {
    "@context": CONTEXTE,
    "@type": "Person",
    name: `${fiche.prenom} ${fiche.nom}`,
    givenName: fiche.prenom,
    familyName: fiche.nom,
    url: absolu(base, `${CHEMIN_CHAMBRE[chambre]}/${fiche.slug}`),
  };
  if (fiche.actif) data.jobTitle = capitale(fonctionDe(chambre, fiche.sexe, true));
  if (fiche.photoUrl) data.image = fiche.photoUrl;
  if (fiche.circonscription) {
    data.description = `${capitale(fonction)} de ${fiche.circonscription.nom} (${fiche.circonscription.departement})`;
  }
  if (fiche.dateNaissance) data.birthDate = fiche.dateNaissance;
  if (fiche.email) data.email = fiche.email;
  if (sameAs.length > 0) data.sameAs = sameAs;
  if (fiche.actif && fiche.groupe) {
    data.worksFor = { "@type": "Organization", name: fiche.groupe.nomComplet || fiche.groupe.nom };
  }
  return data;
};

const NOM_CHAMBRE: Record<Chambre, string> = {
  assemblee: "Assemblée nationale",
  senat: "Sénat",
};

/** Un groupe politique (`Organization`, membre de sa chambre). */
export const groupeJsonLd = (
  base: string,
  groupe: {
    chambre: Chambre;
    slug: string;
    nom: string;
    nomComplet: string | null;
    logoUrl: string | null;
    membresActifsCount: number;
  },
): JsonLd => {
  const url = absolu(base, `/groupes/${groupe.chambre}/${groupe.slug}`);
  const chambre = NOM_CHAMBRE[groupe.chambre];
  const data: JsonLd = {
    "@context": CONTEXTE,
    "@type": "Organization",
    "@id": url,
    name: groupe.nomComplet || groupe.nom,
    url,
    description: `Groupe politique — ${chambre} — ${groupe.membresActifsCount} membres`,
    memberOf: { "@type": "Organization", name: chambre },
  };
  if (groupe.nomComplet) data.alternateName = groupe.nom;
  if (groupe.logoUrl) data.logo = groupe.logoUrl;
  return data;
};

/** Siège de chaque chambre, lieu du vote. */
const SIEGES: Record<Chambre, { rue: string; codePostal: string; site: string }> = {
  assemblee: {
    rue: "126 Rue de l'Université",
    codePostal: "75007",
    site: "https://www.assemblee-nationale.fr",
  },
  senat: { rue: "15 Rue de Vaugirard", codePostal: "75006", site: "https://www.senat.fr" },
};

/** Un scrutin public (`Event`), avec son résultat et son décompte. */
export const scrutinJsonLd = (
  scrutin: {
    numero: number;
    titre: string;
    chambre: Chambre;
    date: string;
    sort: string;
    nombrePour: number;
    nombreContre: number;
    nombreAbstention: number;
  },
  url: string,
): JsonLd => {
  const chambre = NOM_CHAMBRE[scrutin.chambre];
  const siege = SIEGES[scrutin.chambre];
  return {
    "@context": CONTEXTE,
    "@type": "Event",
    name: `Scrutin n°${scrutin.numero} — ${scrutin.titre}`,
    description: scrutin.titre,
    url,
    startDate: scrutin.date,
    endDate: scrutin.date,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: chambre,
      address: {
        "@type": "PostalAddress",
        streetAddress: siege.rue,
        addressLocality: "Paris",
        postalCode: siege.codePostal,
        addressCountry: "FR",
      },
    },
    organizer: { "@type": "Organization", name: chambre, url: siege.site },
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "result",
        value: estAdopte(scrutin.sort) ? "Adopté" : "Rejeté",
      },
      { "@type": "PropertyValue", name: "votesFor", value: scrutin.nombrePour },
      { "@type": "PropertyValue", name: "votesAgainst", value: scrutin.nombreContre },
      { "@type": "PropertyValue", name: "abstentions", value: scrutin.nombreAbstention },
    ],
  };
};

/** Un représentant d'intérêts inscrit à la HATVP (`Organization`). */
export const lobbyisteJsonLd = (
  base: string,
  lobbyiste: {
    id: string;
    nom: string;
    secteur: string | null;
    ville: string | null;
    nbLobbyistes: number | null;
  },
): JsonLd => {
  const data: JsonLd = {
    "@context": CONTEXTE,
    "@type": "Organization",
    name: lobbyiste.nom,
    url: absolu(base, `/lobbying/${lobbyiste.id}`),
    description: lobbyiste.secteur ? `${lobbyiste.nom} — ${lobbyiste.secteur}` : lobbyiste.nom,
  };
  if (lobbyiste.nbLobbyistes) {
    data.numberOfEmployees = { "@type": "QuantitativeValue", value: lobbyiste.nbLobbyistes };
  }
  if (lobbyiste.ville) {
    data.address = {
      "@type": "PostalAddress",
      addressLocality: lobbyiste.ville,
      addressCountry: "FR",
    };
  }
  return data;
};
