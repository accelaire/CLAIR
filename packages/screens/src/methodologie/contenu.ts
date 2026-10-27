/** Contenu de la page « Méthodologie » (repris de apps/web/app/methodologie/page.tsx). */
import {
  type Block,
  externalLink,
  labelled,
  list,
  orderedList,
  paragraph,
  type RichText,
  strong,
} from "../shared/rich-text/rich-text.ts";

export type Source = {
  /** Ancre de la carte (`#hatvp` est cité par d'autres pages). */
  id?: string;
  title: string;
  url: string;
  urlLabel: string;
  intro: string;
  collected: readonly RichText[];
  format?: string;
};

export const sources: readonly Source[] = [
  {
    title: "Assemblée nationale - Open Data",
    url: "https://data.assemblee-nationale.fr",
    urlLabel: "data.assemblee-nationale.fr",
    intro:
      "Le portail Open Data de l'Assemblée nationale fournit des exports JSON complets de l'activité parlementaire.",
    collected: [
      labelled("Députés", "identité, groupe politique, circonscription, mandats"),
      labelled("Scrutins publics", "votes solennels et ordinaires avec résultats détaillés"),
      labelled(
        "Votes individuels",
        "position de chaque député sur chaque scrutin (pour, contre, abstention, absent)",
      ),
      labelled("Amendements", "texte, auteur, sort (adopté, rejeté, retiré)"),
      labelled("Dossiers législatifs", "projets et propositions de loi, procédure"),
      labelled("Commissions", "organes parlementaires, types, composition et mandats des membres"),
      labelled(
        "Réunions",
        "agenda des commissions et séances publiques, participants, ordres du jour",
      ),
      labelled("Vidéos", "replays des séances et commissions (via videos.assemblee-nationale.fr)"),
    ],
    format: "Archives ZIP contenant des fichiers JSON",
  },
  {
    title: "Sénat - Open Data",
    url: "https://data.senat.fr",
    urlLabel: "data.senat.fr",
    intro:
      "Le Sénat publie ses données en open data via son portail dédié (data.senat.fr), complété par le scraping de pages publiques (senat.fr, videos.senat.fr) lorsque l'open data ne couvre pas un périmètre.",
    collected: [
      labelled(
        "Sénateurs",
        "identité, groupe politique, circonscription, série (en cours) + historique complet des anciens sénateurs, mandats et appartenances de groupe datés (ODSEN, data.senat.fr)",
      ),
      labelled(
        "Scrutins publics",
        "votes avec résultats par groupe, y compris l'historique complet via la base DOSLEG (data.senat.fr)",
      ),
      labelled("Votes individuels", "position de chaque sénateur"),
      labelled("Amendements", "propositions de modification des textes"),
      labelled("Interventions", "prises de parole en séance"),
      labelled(
        "Commissions",
        "commissions permanentes, spéciales et d'enquête, avec composition des bureaux (président, vice-présidents, secrétaires, rapporteur général — scraping senat.fr)",
      ),
      labelled("Réunions", "comptes rendus des commissions avec participants identifiés"),
      labelled(
        "Dossiers législatifs",
        "base DOSLEG (data.senat.fr) avec commissions saisies au fond et pour avis (scraping senat.fr)",
      ),
      labelled(
        "Agenda des séances",
        "séances publiques à venir avec ordres du jour (via l'API senat.fr)",
      ),
      labelled("Vidéos", "replays des séances publiques (scraping videos.senat.fr)"),
    ],
    format:
      "Archives ZIP (DOSLEG), CSV latin1 (ODSEN), JSON (API senat.fr), HTML scraping (bureaux, commissions saisies, vidéos)",
  },
  {
    title: "DILA - Comptes rendus des débats",
    url: "https://echanges.dila.gouv.fr/OPENDATA",
    urlLabel: "echanges.dila.gouv.fr/OPENDATA",
    intro:
      "La Direction de l'Information Légale et Administrative publie les comptes rendus intégraux des débats parlementaires.",
    collected: [
      labelled("Interventions", "texte intégral des prises de parole en séance"),
      labelled("Questions au Gouvernement", "questions orales et réponses"),
      labelled("Explications de vote", "justifications des positions"),
    ],
    format: "Archives TAR contenant des fichiers XML",
  },
  {
    id: "hatvp",
    title: "HATVP - Répertoire des représentants d'intérêts",
    url: "https://www.hatvp.fr/le-repertoire/",
    urlLabel: "hatvp.fr/le-repertoire",
    intro:
      "La Haute Autorité pour la Transparence de la Vie Publique tient le registre obligatoire des lobbyistes en France.",
    collected: [
      labelled(
        "Représentants d'intérêts",
        "entreprises, associations, cabinets de conseil, syndicats",
      ),
      labelled("Actions de lobbying", "description des actions menées"),
      labelled("Cibles", "parlementaires ou administrations contactés"),
      labelled("Budgets déclarés", "moyens consacrés au lobbying"),
    ],
  },
];

/** Encart « Note sur le comptage » de la carte HATVP. */
export const hatvpNote: readonly Block[] = [
  paragraph(
    "Les chiffres affichés sur CLAIR peuvent différer de ceux du site HATVP. Cela s'explique par notre méthodologie :",
  ),
  list(
    labelled(
      "Actions par exercice",
      "CLAIR compte chaque activité déclarée par exercice fiscal. Une activité identique déclarée sur 3 ans = 3 actions dans CLAIR.",
    ),
    labelled(
      "Historique complet",
      "CLAIR conserve l'historique depuis 2018, alors que HATVP peut n'afficher que les données récentes ou agrégées.",
    ),
    labelled(
      "Entités distinctes",
      "Les branches régionales d'organisations (ex: Chambres de métiers départementales) sont comptées séparément si elles ont des identifiants HATVP distincts.",
    ),
  ),
  paragraph([
    "Cette approche offre une ",
    strong("transparence maximale"),
    " sur l'évolution du lobbying dans le temps.",
  ]),
];

export const collectProcess = orderedList(
  labelled(
    "Vérification des mises à jour",
    "Le système vérifie régulièrement si de nouvelles données sont disponibles sur les sources (via ETag ou date de modification).",
  ),
  labelled(
    "Téléchargement",
    "Les nouvelles archives sont téléchargées et décompressées (ZIP pour l'AN, TAR/XML pour la DILA).",
  ),
  labelled(
    "Transformation",
    "Les données brutes sont transformées pour correspondre à notre modèle de données unifié.",
  ),
  labelled(
    "Stockage",
    "Les données sont enregistrées dans notre base PostgreSQL avec traçabilité de la source.",
  ),
  labelled("Indexation", "Les données sont indexées pour permettre la recherche full-text."),
);

export const updateFrequency = list(
  labelled("Scrutins et votes", "Synchronisation quotidienne"),
  labelled("Parlementaires", "Synchronisation quotidienne"),
  labelled("Interventions", "Synchronisation quotidienne"),
  labelled("Amendements", "Synchronisation quotidienne"),
  labelled("Lobbying (HATVP)", "Synchronisation hebdomadaire"),
  labelled("Commissions et réunions", "Synchronisation biquotidienne"),
  labelled(
    "Vidéos et directs",
    "Détection en temps réel pour l'Assemblée nationale (proxy vers l'API vidéo), synchronisation biquotidienne pour le Sénat (scraping videos.senat.fr)",
  ),
);

export const aiTechnology = paragraph([
  "CLAIR s'appuie sur les modèles de ",
  externalLink("Mistral AI", "https://mistral.ai"),
  ", une entreprise française spécialisée dans l'IA générative. Le modèle ",
  strong("Mistral Small"),
  " est utilisé pour sa capacité à traiter du texte en français avec précision et sobriété. Le modèle ",
  strong("mistral-embed"),
  " calcule les vecteurs sémantiques utilisés pour le classement et le rattachement des dossiers aux sujets parlementaires.",
]);

export const complementarySources: readonly Block[] = [
  paragraph(
    "Pour enrichir les fiches de parlementaires et le rattachement des sujets, CLAIR s'appuie sur des sources publiques complémentaires, toujours signalées comme telles :",
  ),
  list(
    [
      externalLink("Wikipédia", "https://fr.wikipedia.org"),
      " : biographies des parlementaires (API publique, extrait textuel).",
    ],
    [
      externalLink("Wikidata", "https://www.wikidata.org"),
      " : faits structurés et sourcés (appartenances politiques, fonctions, dates) avec lien citable vers chaque entité.",
    ],
  ),
  paragraph(
    "Ces sources ne remplacent jamais les données officielles : elles apportent uniquement du contexte biographique ou thématique.",
  ),
];

export const enrichedData = list(
  labelled(
    "Résumés de scrutins",
    "Chaque scrutin public reçoit un résumé en langage clair expliquant l'objet du vote et son contexte.",
  ),
  labelled(
    "Synthèses de dossiers législatifs",
    "Les dossiers sont résumés avec une analyse des positions des groupes politiques basée sur les votes effectifs de leurs membres.",
  ),
  labelled(
    "Résumés de sujets parlementaires",
    "Les sujets transversaux regroupant plusieurs dossiers bénéficient d'une synthèse globale.",
  ),
  labelled(
    "Fiches de parlementaires",
    "Chaque député et sénateur dispose d'une fiche de synthèse (résumé, parcours, positions clés, faits notables) rédigée à partir de ses données officielles (mandats, statistiques de votes et d'interventions, déclarations HATVP) complétées par des sources publiques (Wikipédia, Wikidata).",
  ),
  labelled(
    "Positions des groupes par sujet",
    "Sur un sujet donné, l'action de chaque groupe politique est résumée à partir des amendements qu'il a effectivement déposés.",
  ),
);

export const reliabilityGuarantees = list(
  labelled(
    "Données factuelles en entrée",
    "Pour les résumés de scrutins, dossiers et sujets, l'IA reçoit uniquement des données officielles (titres, résultats de votes, positions des groupes) et non des opinions. Les fiches de parlementaires s'appuient en complément sur des sources publiques (Wikipédia, Wikidata), toujours signalées comme générées par IA.",
  ),
  labelled(
    "Positions calculées, pas générées",
    "Les positions des groupes politiques sont calculées à partir des votes individuels réels, puis transmises à l'IA comme contexte factuel.",
  ),
  labelled(
    "Contrôle qualité automatisé",
    "Un pipeline de vérification détecte les inversions de position et les incohérences entre les résumés générés et les données sources.",
  ),
  labelled(
    "Aucune donnée inventée",
    "L'IA ne génère pas de statistiques ou de chiffres. Tous les nombres affichés proviennent directement des sources officielles.",
  ),
);

export const dataModel = [
  {
    title: "Parlementaire",
    text: "Député ou sénateur avec son identité, groupe politique, circonscription, et statistiques d'activité (présence, loyauté au groupe, nombre d'interventions et amendements).",
  },
  {
    title: "Groupe politique",
    text: "Groupe parlementaire à l'Assemblée ou au Sénat, avec sa position sur l'échiquier politique et la liste de ses membres.",
  },
  {
    title: "Scrutin",
    text: "Vote public avec date, titre, type (solennel, ordinaire, motion), résultat global et répartition des votes.",
  },
  {
    title: "Vote",
    text: "Position individuelle d'un parlementaire sur un scrutin : pour, contre, abstention ou absent.",
  },
  {
    title: "Intervention",
    text: "Prise de parole en séance : question, intervention libre, ou explication de vote.",
  },
  {
    title: "Amendement",
    text: "Proposition de modification d'un texte avec auteur, contenu et sort (adopté, rejeté, retiré).",
  },
  {
    title: "Commission",
    text: "Commission parlementaire (permanente, spéciale, d'enquête) avec ses membres actuels et anciens, ses réunions et les dossiers législatifs examinés.",
  },
  {
    title: "Réunion",
    text: "Séance publique ou réunion de commission avec date, lieu, ordre du jour, participants et lien vers la vidéo.",
  },
  {
    title: "Lobbyiste",
    text: "Représentant d'intérêts inscrit au répertoire HATVP : entreprise, association, cabinet de conseil, syndicat.",
  },
  {
    title: "Action de lobbying",
    text: "Action menée par un lobbyiste auprès d'un parlementaire ou d'une administration, avec dates et budget.",
  },
] as const;

export const stack = [
  {
    title: "Frontend",
    items: ["Next.js 14 (App Router)", "TypeScript", "Tailwind CSS", "TanStack Query"],
  },
  { title: "Backend", items: ["Fastify", "Prisma ORM", "PostgreSQL", "Redis (cache & queues)"] },
  {
    title: "Ingestion",
    items: ["Mistral AI (résumés + embeddings)", "Connecteurs sources (open data + scraping)"],
  },
] as const;

export const limitations = list(
  labelled(
    "Délai de publication",
    "Les données ne sont disponibles sur CLAIR qu'après leur publication par les sources officielles, généralement sous 24 à 48h.",
  ),
  labelled(
    "Scrutins non publics",
    "Seuls les scrutins publics sont disponibles. Les votes en commission ou à main levée ne sont pas enregistrés nominativement.",
  ),
  labelled(
    "Données HATVP",
    "Les informations de lobbying sont déclaratives. Leur exactitude dépend des déclarations des représentants d'intérêts.",
  ),
  labelled(
    "Statistiques calculées",
    "Les taux de présence et de loyauté sont calculés par nos soins à partir des données brutes. La méthodologie de calcul est documentée dans notre code source.",
  ),
);
