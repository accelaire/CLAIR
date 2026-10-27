/**
 * Ce qu'une circonscription de la série 2 permet d'écrire (repris de apps/web
 * `lib/senatoriales/circonscription.ts`). Partagé par la page, ses métadonnées et son aperçu
 * Open Graph : les trois décrivent la même circonscription et doivent en dire la même chose.
 */

/**
 * Libellé d'affichage : « Français établis hors de France (Série 2) » se passe de son rappel de
 * série dans un titre qui annonce déjà les sénatoriales 2026.
 */
export const libelleCirconscription = (nom: string): string =>
  nom.replace(/\s*\(Série \d+\)\s*$/, "").trim();

export type ModeDeScrutin = {
  court: string;
  /** Deux mots, pour une pastille d'image OG. */
  bref: string;
  /** Ce qu'une candidature est ici : une liste bloquée, ou une candidature. */
  unite: "liste" | "candidature";
  phrase: string;
};

/**
 * Mode de scrutin d'une circonscription : il tient au nombre de sièges à pourvoir, et à lui
 * seul (article L. 295 du code électoral).
 */
export const modeDeScrutin = (nbSieges: number): ModeDeScrutin =>
  nbSieges >= 3
    ? {
        court: "proportionnel de liste à un tour",
        bref: "proportionnel",
        unite: "liste",
        phrase:
          "Les sièges sont pourvus au scrutin proportionnel de liste à un tour, à la plus forte moyenne. Les électeurs votent pour une liste bloquée, sans panachage ni vote préférentiel.",
      }
    : {
        court: "majoritaire à deux tours",
        bref: "majoritaire",
        unite: "candidature",
        phrase:
          "Les sièges sont pourvus au scrutin majoritaire à deux tours. Est élu au premier tour le candidat qui réunit la majorité absolue des suffrages exprimés et le quart des électeurs inscrits ; au second tour, la majorité relative suffit.",
      };
