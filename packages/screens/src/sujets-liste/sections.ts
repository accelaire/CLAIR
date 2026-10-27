import type { SujetListItem } from "@clair/data";

/** Nombre de sujets affichés par section avant « Voir plus ». */
export const VISIBLES_INITIAUX = 12;

const JOUR_MS = 86_400_000;

const temps = (date: string | null) => (date ? new Date(date).getTime() : 0);
const parDernierVote = (a: SujetListItem, b: SujetListItem) =>
  temps(b.dateDernierVote) - temps(a.dateDernierVote);

export type SectionsSujets = {
  /** Sujet « À la une » : actif, au moins 5 scrutins, voté dans les 90 derniers jours. */
  aLaUne: SujetListItem | null;
  /** Promulgués depuis moins de six mois (six au plus). */
  recemmentPromulgues: SujetListItem[];
  enDiscussion: SujetListItem[];
  promulgues: SujetListItem[];
  rejetes: SujetListItem[];
  autres: SujetListItem[];
};

/**
 * Répartit les sujets comme apps/web : en discussion (`en_cours` et `adopte`, la navette n'est pas
 * finie), promulgués, rejetés, caducs et retirés. Le sujet « À la une » change chaque jour parmi
 * les candidats ; il n'est proposé que hors recherche.
 */
export const sectionsDe = (
  sujets: SujetListItem[],
  { recherche, maintenant }: { recherche: boolean; maintenant: number },
): SectionsSujets => {
  const enDiscussionTous = sujets
    .filter((s) => s.status === "en_cours" || s.status === "adopte")
    .sort(parDernierVote);
  const promulgues = sujets
    .filter((s) => s.status === "promulgue")
    .sort((a, b) => temps(b.dateFin) - temps(a.dateFin));
  const rejetes = sujets.filter((s) => s.status === "rejete").sort(parDernierVote);
  const autres = sujets
    .filter((s) => s.status === "caduc" || s.status === "retire")
    .sort(parDernierVote);

  const candidats = enDiscussionTous.filter(
    (s) => s.scrutinCount >= 5 && temps(s.dateDernierVote) > maintenant - 90 * JOUR_MS,
  );
  const aLaUne =
    !recherche && candidats.length > 0
      ? (candidats[Math.floor(maintenant / JOUR_MS) % candidats.length] ?? null)
      : null;
  const recemmentPromulgues = recherche
    ? []
    : promulgues.filter((s) => temps(s.dateFin) > maintenant - 180 * JOUR_MS).slice(0, 6);

  return {
    aLaUne,
    recemmentPromulgues,
    enDiscussion: enDiscussionTous.filter((s) => s.id !== aLaUne?.id),
    promulgues,
    rejetes,
    autres,
  };
};
