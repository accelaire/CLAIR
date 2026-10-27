import type { GuideArticle } from "../types.ts";
import { comparerDesElus } from "./comparer-des-elus.ts";
import { comprendreLeLobbying } from "./comprendre-le-lobbying.ts";
import { decouvrirMonDepute } from "./decouvrir-mon-depute.ts";
import { decrypterUnScrutin } from "./decrypter-un-scrutin.ts";
import { suivreUnSujet } from "./suivre-un-sujet.ts";

/** Parcours du guide par adresse, dans l'ordre de la rubrique. */
export const GUIDE_ARTICLES = {
  "decouvrir-mon-depute": decouvrirMonDepute,
  "suivre-un-sujet": suivreUnSujet,
  "comparer-des-elus": comparerDesElus,
  "comprendre-le-lobbying": comprendreLeLobbying,
  "decrypter-un-scrutin": decrypterUnScrutin,
} as const satisfies Record<string, GuideArticle>;

export type GuideSlug = keyof typeof GUIDE_ARTICLES;

/** Parcours dans l'ordre de la rubrique (accueil, liens précédent / suivant). */
export const GUIDE_ORDER: readonly GuideArticle[] = Object.values(GUIDE_ARTICLES);
