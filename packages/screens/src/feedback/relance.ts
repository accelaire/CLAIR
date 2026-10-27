/**
 * Règles de la relance du formulaire de retour (« Un retour à nous faire ? »), reprises de
 * `components/feedback/FeedbackWidget.tsx` de apps/web.
 *
 * Rien n'est envoyé au serveur : les compteurs vivent dans le navigateur (`sessionStorage` pour
 * la visite, `localStorage` pour « déjà répondu » et « ne plus me le proposer »), sans cookie.
 * Le stockage est passé en paramètre pour tester les règles sans navigateur.
 */

export type Stockage = Pick<Storage, "getItem" | "setItem">;

/** Silence après « Ignorer » : 45 jours. */
export const DUREE_SILENCE_MS = 45 * 24 * 60 * 60 * 1000;
/** Une action forte ou une seule page de valeur ne suffisent qu'après une minute de visite. */
const DELAI_MS = 60_000;

/** Clés reprises de apps/web : un visiteur qui a déjà répondu n'est pas relancé par le nouveau site. */
export const CLES = {
  actions: "clair_fb_actions",
  forte: "clair_fb_strong",
  debut: "clair_fb_start",
  relanceVue: "clair_fb_nudge_displayed",
  repondu: "clair_fb_answered",
  silence: "clair_fb_silenced_until",
} as const;

/** Événement émis par `signalerActionForte`, écouté par le widget. */
export const EVENEMENT_ACTION_FORTE = "clair-fb-strong";

const RUBRIQUES_DE_VALEUR = new Set([
  "deputes",
  "senateurs",
  "scrutins",
  "dossiers",
  "sujets",
  "lobbying",
]);

/** Page de détail (fiche d'élu, scrutin, dossier…) : sa visite compte comme une action. */
export const estPageDeValeur = (chemin: string) => {
  const segments = chemin.split("/").filter(Boolean);
  if (segments.length !== 2) return false;
  const [rubrique = "", sousPage = ""] = segments;
  return RUBRIQUES_DE_VALEUR.has(rubrique) && sousPage !== "comparer" && sousPage !== "actions";
};

const entier = (valeur: string | null) => {
  const nombre = Number.parseInt(valeur ?? "0", 10);
  return Number.isNaN(nombre) ? 0 : nombre;
};

/** Compte une action de la visite (et date le début de la visite à la première). */
export const compterAction = (session: Stockage, maintenant: number) => {
  session.setItem(CLES.actions, String(entier(session.getItem(CLES.actions)) + 1));
  if (!session.getItem(CLES.debut)) session.setItem(CLES.debut, String(maintenant));
};

/**
 * La relance s'affiche-t-elle ? Jamais si le visiteur a répondu, l'a ignorée il y a moins de
 * 45 jours ou l'a déjà vue pendant la visite ; sinon après deux actions, ou une action (forte ou
 * non) et une minute de visite.
 */
export const doitRelancer = (session: Stockage, local: Stockage, maintenant: number) => {
  if (local.getItem(CLES.repondu) === "1") return false;
  if (entier(local.getItem(CLES.silence)) > maintenant) return false;
  if (session.getItem(CLES.relanceVue) === "1") return false;
  const actions = entier(session.getItem(CLES.actions));
  const forte = session.getItem(CLES.forte) === "1";
  const debut = entier(session.getItem(CLES.debut));
  const uneMinute = debut > 0 && maintenant - debut >= DELAI_MS;
  return actions >= 2 || ((forte || actions >= 1) && uneMinute);
};

/**
 * À appeler depuis un autre composant (partage, comparateur…) pour signaler une action forte :
 * elle compte double dans la règle de relance.
 */
export const signalerActionForte = () => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CLES.forte, "1");
    compterAction(window.sessionStorage, Date.now());
    window.dispatchEvent(new Event(EVENEMENT_ACTION_FORTE));
  } catch {
    // Stockage indisponible (navigation privée stricte) : la relance n'est qu'un confort.
  }
};
