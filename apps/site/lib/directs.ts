/**
 * Retransmissions vidéo en direct du jour, à l'Assemblée nationale et au Sénat, reprises de la
 * route `apps/web/app/api/live-now/route.ts`. Servies par `app/api/v1/agenda/direct/route.ts`.
 *
 * Deux sources, lues à la volée (aucune n'est dans l'API de CLAIR) :
 *   - `videos.assemblee-nationale.fr/php/eventsearch.php`, en JSON : séances publiques et
 *     commissions, reliées aux organes par une table fixe de codes vidéo ;
 *   - la page HTML `videos.senat.fr/direct`, dont on lit les cartes `card-live` : séances publiques.
 * Fragile par nature (grattage, table de codes) : une source qui échoue ne prive pas de l'autre.
 */
import type { DirectCommission, DirectSeance, DirectsDuJour } from "@clair/data";

const AN_BASE = "https://videos.assemblee-nationale.fr";
const AN_SEARCH_URL = `${AN_BASE}/php/eventsearch.php`;
const SENAT_BASE = "https://videos.senat.fr";
const USER_AGENT = "CLAIR-bot (transparence-politique, contact@clair.vote)";
const DELAI_MS = 5000;

/** Code vidéo d'une commission de l'Assemblée → `organeRef` de l'organe (table de apps/web). */
const AN_VIDEO_CODE_TO_ORGANE: Record<string, string> = {
  CION_DEF: "PO59046",
  CION_AFETR: "PO59047",
  CION_FIN: "PO59048",
  CION_LOIS: "PO59051",
  "CION-CEDU": "PO419604",
  "CION-SOC": "PO420120",
  "CION-ECO": "PO419610",
  "CION-DVP": "PO419865",
  AFFEUROP: "PO415287",
  CEC: "PO420375",
  COLTER: "PO744127",
  DDE: "PO804431",
  OM: "PO675659",
  DUE: "PO59054",
  OTS: "PO273589",
};

/** Vidéo telle que la renvoie la recherche de l'Assemblée. */
export type VideoAssemblee = {
  date: string;
  url: string;
  video_type: string;
  commission: string | null;
  title: string;
  published: boolean;
};

/** Carte « en direct » de la page du Sénat. */
export type DirectSenat = { href: string; subtitle: string };

/** « 2e séance du… » → 2 ; « 1re séance… » → 1. */
export const ordreSeanceAssemblee = (titre: string): number | null => {
  const m = titre.match(/^(\d+)[eè]me?\s+s[eé]ance/i);
  if (m?.[1]) return Number.parseInt(m[1], 10);
  if (/^1[eè]re?\s+s[eé]ance/i.test(titre)) return 1;
  return null;
};

const MOIS: Record<string, string> = {
  janvier: "01",
  fevrier: "02",
  mars: "03",
  avril: "04",
  mai: "05",
  juin: "06",
  juillet: "07",
  aout: "08",
  septembre: "09",
  octobre: "10",
  novembre: "11",
  decembre: "12",
};

const MOMENTS: Record<string, number> = { matin: 1, "apres-midi": 2, soir: 3 };

/** `seance-publique-du-12-novembre-2026-apres-midi` → `{ isoDate: "2026-11-12", order: 2 }`. */
export const seanceSenatDuSlug = (slug: string): { isoDate: string; order: number } | null => {
  const m = slug.match(/seance-publique-du-(\d{1,2})-([a-z]+)-(\d{4})-(matin|apres-midi|soir)$/);
  if (!m?.[1] || !m[2] || !m[3] || !m[4]) return null;
  const mois = MOIS[m[2]];
  const order = MOMENTS[m[4]];
  if (!mois || !order) return null;
  return { isoDate: `${m[3]}-${mois}-${m[1].padStart(2, "0")}`, order };
};

/** Cartes `card-live` de la page HTML `videos.senat.fr/direct`. */
export const cartesDirectSenat = (html: string): DirectSenat[] =>
  html
    .split("card-live")
    .slice(1)
    .flatMap((bloc) => {
      const href = bloc.match(/href="(video\.[^"]+)"/)?.[1];
      if (!href) return [];
      return [{ href, subtitle: bloc.match(/card-subtitle[^>]*>([^<]+)/)?.[1]?.trim() ?? "" }];
    });

/** Jour (UTC, `YYYY-MM-DD`) d'une date en secondes Unix, ou `null`. */
const jourUnix = (date: string) => {
  const secondes = Number.parseInt(date, 10);
  return Number.isNaN(secondes) ? null : new Date(secondes * 1000).toISOString().slice(0, 10);
};

/**
 * Directs du jour `aujourdhui` (UTC, comme apps/web) à partir des réponses brutes des deux
 * chambres.
 */
export const directsDuJour = (
  {
    seancesAssemblee,
    commissionsAssemblee,
    senat,
  }: {
    seancesAssemblee: VideoAssemblee[];
    commissionsAssemblee: VideoAssemblee[];
    senat: DirectSenat[];
  },
  aujourdhui: string,
): DirectsDuJour => {
  const commissions: DirectCommission[] = [];
  const seances: DirectSeance[] = [];

  for (const video of commissionsAssemblee) {
    if (video.published === false || jourUnix(video.date) !== aujourdhui) continue;
    const code = video.commission?.split(";")[0]?.trim();
    const organeRef = code ? AN_VIDEO_CODE_TO_ORGANE[code] : undefined;
    if (!organeRef) continue;
    commissions.push({
      organeRef,
      directUrl: `${AN_BASE}/direct.${video.url.replace(/^\//, "")}`,
      chambre: "assemblee",
    });
  }

  for (const video of seancesAssemblee) {
    if (video.published === false || jourUnix(video.date) !== aujourdhui) continue;
    const order = ordreSeanceAssemblee(video.title);
    if (order === null) continue;
    seances.push({
      isoDate: aujourdhui,
      order,
      directUrl: `${AN_BASE}/direct.${video.url.replace(/^\//, "")}`,
      chambre: "assemblee",
    });
  }

  for (const carte of senat) {
    if (!/s[ée]ance publique/i.test(carte.subtitle)) continue;
    const seance = seanceSenatDuSlug(carte.href.replace(/^video\.\d+_[a-f0-9]+\./, ""));
    if (!seance) continue;
    seances.push({ ...seance, directUrl: `${SENAT_BASE}/${carte.href}`, chambre: "senat" });
  }

  return { commissions, seances };
};

const lireVideosAssemblee = async (typeVideo: string): Promise<VideoAssemblee[]> => {
  const params = new URLSearchParams({
    Date: "",
    Intervenant: "",
    Commission: "",
    Heure: "",
    TypeVideo: typeVideo,
    Rubrique: "",
    rnd: String(Date.now()),
  });
  const reponse = await fetch(`${AN_SEARCH_URL}?${params}`, {
    headers: { "User-Agent": USER_AGENT, Referer: AN_BASE },
    signal: AbortSignal.timeout(DELAI_MS),
  });
  if (!reponse.ok) return [];
  const texte = await reponse.text();
  // La réponse commence parfois par une marque d'ordre des octets.
  const json = texte.charCodeAt(0) === 0xfeff ? texte.slice(1) : texte;
  const donnees: unknown = JSON.parse(json);
  return Array.isArray(donnees) ? (donnees as VideoAssemblee[]) : [];
};

const lireDirectSenat = async (): Promise<DirectSenat[]> => {
  const reponse = await fetch(`${SENAT_BASE}/direct`, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html", Referer: SENAT_BASE },
    signal: AbortSignal.timeout(DELAI_MS),
  });
  return reponse.ok ? cartesDirectSenat(await reponse.text()) : [];
};

/** Une source en échec compte pour vide : l'autre chambre reste affichée. */
const ouVide = async <T>(promesse: Promise<T[]>): Promise<T[]> => {
  try {
    return await promesse;
  } catch (error) {
    console.error("[directs] source indisponible", error);
    return [];
  }
};

/** Interroge les deux chambres et renvoie les directs du jour. */
export const chargerDirects = async (maintenant = new Date()): Promise<DirectsDuJour> => {
  const [seancesAssemblee, commissionsAssemblee, senat] = await Promise.all([
    ouVide(lireVideosAssemblee("Séance publique")),
    ouVide(lireVideosAssemblee("Commission")),
    ouVide(lireDirectSenat()),
  ]);
  return directsDuJour(
    { seancesAssemblee, commissionsAssemblee, senat },
    maintenant.toISOString().slice(0, 10),
  );
};
