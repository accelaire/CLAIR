// Pages capturées, dans l'ordre du menu. `chemin` vaut pour les deux fronts ; `beta` le remplace
// pour le nouveau quand l'adresse diffère (onglet : `#nom` dans l'ancien, `?onglet=nom` dans le nouveau).
// Exemples pris dans la base locale (dump du 22/10/2026), choisis par ordre alphabétique ou de date,
// sans critère politique.
const DEPUTE = "audrey-abadie-amiel";
const SENATEUR = "marie-do-aeschlimann";
const SCRUTIN = "/scrutins/7979?chambre=assemblee&session=17";
const DOSSIER = "/dossiers/DLR5L17N52428";
const COMMISSION = "/commissions/assemblee-commission-des-finances-de-l-economie-generale-et-du-controle-budgetai";
const REUNION = "/reunions/RUANR5L17S2027IDS30940";
const LOBBYISTE = "/lobbying/eb83e4a4-0eef-4782-b5c4-8d979e39383b";
const GOUVERNEMENT = "/gouvernements/lecornu-2";

const onglet = (base, nom) => ({
  chemin: `${base}#${nom}`,
  beta: `${base}${base.includes("?") ? "&" : "?"}onglet=${nom}`,
});

export const PAGES = [
  { dossier: "01-accueil", chemin: "/" },
  { dossier: "02-recherche", chemin: "/recherche?q=budget" },

  { dossier: "10-deputes-liste", chemin: "/deputes" },
  { dossier: "11-depute-fiche-votes", chemin: `/deputes/${DEPUTE}` },
  { dossier: "12-depute-fiche-interventions", ...onglet(`/deputes/${DEPUTE}`, "interventions") },
  { dossier: "13-depute-fiche-amendements", ...onglet(`/deputes/${DEPUTE}`, "amendements") },
  { dossier: "14-deputes-comparer", chemin: "/deputes/comparer" },
  { dossier: "15-senateurs-liste", chemin: "/senateurs" },
  { dossier: "16-senateur-fiche-votes", chemin: `/senateurs/${SENATEUR}` },
  { dossier: "17-senateur-fiche-interventions", ...onglet(`/senateurs/${SENATEUR}`, "interventions") },
  { dossier: "18-senateurs-comparer", chemin: "/senateurs/comparer" },
  { dossier: "19-groupes-liste", chemin: "/groupes" },
  { dossier: "20-groupe-fiche-assemblee", chemin: "/groupes/assemblee/gdr" },
  { dossier: "21-classements", chemin: "/classements" },
  { dossier: "22-gouvernements-liste", chemin: "/gouvernements" },
  { dossier: "23-gouvernement-fiche", chemin: GOUVERNEMENT },

  { dossier: "30-scrutins-liste", chemin: "/scrutins" },
  { dossier: "31-scrutin-fiche-vote", ...onglet(SCRUTIN, "vote") },
  { dossier: "32-scrutin-fiche-debats", ...onglet(SCRUTIN, "debats") },
  { dossier: "33-votes-archives", chemin: "/votes" },
  { dossier: "34-votes-annee", chemin: "/votes/2025" },
  { dossier: "35-votes-mois", chemin: "/votes/2025/10" },
  { dossier: "36-dossiers-liste", chemin: "/dossiers" },
  { dossier: "37-dossier-fiche-parcours", chemin: DOSSIER },
  { dossier: "38-dossier-fiche-amendements", ...onglet(DOSSIER, "amendements") },
  { dossier: "39-dossier-fiche-scrutins", ...onglet(DOSSIER, "scrutins") },
  { dossier: "40-sujets-liste", chemin: "/sujets" },
  { dossier: "41-sujet-fiche", chemin: "/sujets/plf-2026" },

  { dossier: "50-commissions-liste", chemin: "/commissions" },
  { dossier: "51-commission-fiche", chemin: COMMISSION },
  { dossier: "52-reunion-seance", chemin: REUNION },
  { dossier: "53-agenda", chemin: "/agenda" },

  { dossier: "60-lobbying", chemin: "/lobbying" },
  { dossier: "61-lobbyiste-fiche", chemin: LOBBYISTE },
  { dossier: "62-lobbying-actions", chemin: "/lobbying/actions" },

  { dossier: "70-senatoriales-2026", chemin: "/senatoriales-2026" },
  { dossier: "71-senatoriales-departement", chemin: "/senatoriales-2026/ain" },
  ...["carte", "groupes", "presence", "activite", "ages", "commissions", "professions"].map(
    (slug, i) => ({ dossier: `${72 + i}-senatoriales-graphique-${slug}`, chemin: `/senatoriales-2026/graphiques/${slug}` }),
  ),

  { dossier: "80-a-propos", chemin: "/a-propos" },
  { dossier: "81-methodologie", chemin: "/methodologie" },
  { dossier: "82-api", chemin: "/api" },
  { dossier: "83-comprendre", chemin: "/comprendre" },
  ...["parlement", "parlementaire", "scrutin", "dossier-legislatif", "groupes-politiques", "commissions", "lobbying"].map(
    (slug, i) => ({ dossier: `${84 + i}-comprendre-${slug}`, chemin: `/comprendre/${slug}` }),
  ),
  { dossier: "91-guide", chemin: "/guide" },
  ...["decouvrir-mon-depute", "decrypter-un-scrutin", "suivre-un-sujet", "comparer-des-elus", "comprendre-le-lobbying"].map(
    (slug, i) => ({ dossier: `${92 + i}-guide-${slug}`, chemin: `/guide/${slug}` }),
  ),
  { dossier: "97-soutenir", chemin: "/soutenir" },
  { dossier: "98-contact", chemin: "/contact" },
  { dossier: "99-cgu", chemin: "/cgu" },
  { dossier: "99b-confidentialite", chemin: "/confidentialite" },
  { dossier: "99c-mentions-legales", chemin: "/mentions-legales" },
  { dossier: "99d-page-introuvable", chemin: "/cette-page-n-existe-pas" },
];
