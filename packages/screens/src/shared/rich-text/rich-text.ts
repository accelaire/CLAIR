/**
 * Texte enrichi des pages éditoriales, écrit en données (fichiers de contenu `.ts`) et rendu par
 * `RichText` / `Blocks`. Couvre ce dont les pages de contenu ont besoin : gras, code, liens
 * internes, externes ou `mailto:`, retours à la ligne, paragraphes et listes.
 */

/** Lien : interne (`/methodologie`), externe (nouvel onglet annoncé) ou `mailto:`. */
export type InlineLink = { text: string; href: string; external?: boolean };

export type Inline =
  | string
  | { strong: string }
  | { em: string }
  | { code: string }
  | { link: InlineLink }
  | { br: true };

/** Texte d'une ligne : une chaîne simple ou une suite de fragments. */
export type RichText = string | readonly Inline[];

export type Block =
  | { type: "paragraph"; text: RichText; tone?: "mention" | "petit" }
  | { type: "list"; ordered?: boolean; items: readonly RichText[] }
  /** Sous-partie introduite par un intitulé en gras (« Données collectées : »). */
  | { type: "labelled"; label: string; blocks: readonly Block[] };

/** `**Libellé** : texte`, forme la plus fréquente des listes de définitions. */
export const labelled = (label: string, ...rest: readonly Inline[]): Inline[] => [
  { strong: label },
  " : ",
  ...rest,
];

export const strong = (text: string): Inline => ({ strong: text });
export const code = (text: string): Inline => ({ code: text });
export const link = (text: string, href: string): Inline => ({ link: { text, href } });
export const externalLink = (text: string, href: string): Inline => ({
  link: { text, href, external: true },
});
export const br: Inline = { br: true };

export const paragraph = (text: RichText): Block => ({ type: "paragraph", text });
export const list = (...items: readonly RichText[]): Block => ({ type: "list", items });
export const orderedList = (...items: readonly RichText[]): Block => ({
  type: "list",
  ordered: true,
  items,
});
