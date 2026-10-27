/** Contenu de la page « À propos » (repris de apps/web/app/a-propos/page.tsx). */
export const offres = [
  {
    icone: "parlementaires",
    titre: "Fiches parlementaires et groupes",
    texte:
      "Profils détaillés des 575 députés et 348 sénateurs de la 17e législature ainsi que de leurs groupes : votes, interventions, amendements, présence, et relations avec les lobbyistes.",
  },
  {
    icone: "scrutins",
    titre: "Scrutins publics",
    texte:
      "Tous les scrutins publics avec le détail des votes par parlementaire et par groupe politique. Filtrez par thème, date ou résultat.",
  },
  {
    icone: "lobbying",
    titre: "Activités de lobbying",
    texte:
      "Données du répertoire des représentants d'intérêts (HATVP) : qui sont les lobbyistes, quelles actions mènent-ils, auprès de qui.",
  },
  {
    icone: "donnees",
    titre: "Données structurées",
    texte:
      "Toutes les données sont synchronisées quotidiennement depuis les sources officielles et structurées pour faciliter l'analyse.",
  },
] as const;

export const valeurs = [
  {
    titre: "Neutralité",
    texte:
      "Aucune opinion politique. Nous présentons les données telles qu'elles sont, sans commentaire ni orientation.",
  },
  {
    titre: "Transparence",
    texte:
      "Notre code est open source. Chacun peut vérifier comment nous traitons les données et contribuer au projet.",
  },
  {
    titre: "Accessibilité",
    texte:
      "L'information politique doit être accessible à tous, sans jargon technique ni barrière à l'entrée.",
  },
] as const;

export const CONTRIBUTION_GUIDE_URL =
  "https://docs.clair.vote/guide/guide-developpeur/contribution";
