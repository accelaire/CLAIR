// Faux serveur de l'API pour les tests e2e du site (`apps/site`) : jamais l'API de production.
//
//   node e2e/fake-api.mjs [port]
//
// Il répond à toute liste de `/api/v1/…` par une page vide, à la forme commune des réponses de
// l'API (`data` + `meta` + `pagination`, voir packages/data/src/common.ts), et à toute fiche par
// un 404. Il ne sert aucune donnée parlementaire, réelle ou inventée : les tests de fumée vérifient
// que chaque rubrique se construit, s'affiche et reste accessible avec une base vide.
import { createServer } from "node:http";

const port = Number(process.argv[2] ?? process.env.PORT ?? 4312);

const meta = { total: 0, page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrev: false };
const pageVide = { data: [], meta, pagination: meta };

/** Réponses des routes dont la forme n'est pas une liste paginée. */
const ROUTES = {
  "/health": { status: "ok" },
  "/api/v1/agenda": {
    ...pageVide,
    dateFrom: "2026-01-05",
    dateTo: "2026-01-11",
    total: 0,
    byDay: {},
    evenements: [],
  },
  "/api/v1/lobbying/stats": {
    data: { totalLobbyistes: 0, totalActions: 0, budgetTotal: 0, totalSecteurs: 0 },
  },
  "/api/v1/parlementaires/historique-carriere": { data: { present: false } },
  "/api/v1/dossiers/filters": { procedures: [] },
  // Sénatoriales 2026 (packages/data/src/senatoriales.ts) : base vide, aucun sortant ni candidat.
  // Les dates du scrutin et le nombre de sièges sont ceux du décret de convocation.
  "/api/v1/senatoriales/2026": {
    scrutin: {
      date: "2026-09-27",
      priseDeFonction: "2026-10-01",
      serie: "2",
      mandatureSortante: 2020,
      mandatureEntrante: 2026,
      nbSieges: 178,
      nbCirconscriptions: 64,
      sources: [],
    },
    sortants: { total: 0, mandatComplet: 0, arriveesEnCours: 0, parGroupe: [] },
    circonscriptions: [],
    candidatures: {
      listes: 0,
      candidats: 0,
      circonscriptions: 0,
      sortantsCandidats: 0,
      sortantsNonCandidats: 0,
      anciensParlementaires: 0,
    },
  },
  "/api/v1/senatoriales/2026/sortants": { data: [], meta: { total: 0 } },
  "/api/v1/senatoriales/2026/candidats": { data: [], meta: { total: 0, candidats: 0 } },
  // Accueil (packages/data/src/homepage.ts) : base vide, aucun dossier ni réunion.
  "/api/v1/homepage": {
    stats: {
      deputes: 0,
      senateurs: 0,
      scrutins: 0,
      dossiers: 0,
      lobbyistes: 0,
      actionsLobby: 0,
      interventions: 0,
      amendements: 0,
    },
    trendingDossiers: [],
    lastUpdate: null,
    upcoming: null,
  },
};

/** Sous-routes qui sont des listes ; toute autre sous-route est une fiche, en 404. */
const LISTES =
  /\/(groupes|annees|periodes|secteurs|legislatures|sessions|actions|votes|compare|tags|trending|recent)$/;
const RACINES = new Set([
  "agenda",
  "classements",
  "commissions",
  "deputes",
  "dossiers",
  "groupes",
  "lobbying",
  "parlementaires",
  "scrutins",
  "senateurs",
  "sujets",
]);

const reponse = (chemin) => {
  if (chemin in ROUTES) return [200, ROUTES[chemin]];
  if (!chemin.startsWith("/api/v1/")) return [404, { error: "Not Found" }];
  const segments = chemin.slice("/api/v1/".length).split("/").filter(Boolean);
  if (segments.length === 1 && RACINES.has(segments[0])) return [200, pageVide];
  if (segments.length > 1 && LISTES.test(chemin)) return [200, pageVide];
  if (segments[0] === "classements") return [200, pageVide];
  return [404, { error: "Not Found", code: "NOT_FOUND" }];
};

const serveur = createServer((requete, res) => {
  const { pathname } = new URL(requete.url ?? "/", "http://localhost");
  const [statut, corps] = reponse(pathname.replace(/\/+$/, "") || "/");
  if (process.env.FAKE_API_LOG) console.log(`${requete.method} ${requete.url} → ${statut}`);
  res.writeHead(statut, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(corps));
});

serveur.listen(port, "127.0.0.1", () => {
  console.log(`Faux serveur d'API sur http://127.0.0.1:${port}`);
});
