/**
 * Adresses et libellés partagés des scrutins (reprise de `lib/scrutin-url.ts`,
 * `lib/periodes.ts` et `lib/nature-scrutin.ts` de apps/web).
 *
 * Un numéro de scrutin n'est unique dans AUCUNE chambre : il repart à 1 à chaque session au Sénat
 * et à chaque législature à l'Assemblée. La clé réelle est `(numero, chambre, session)`, où
 * `session` porte la session au Sénat et la législature à l'Assemblée. Tout lien vers un scrutin
 * transporte donc `chambre` ET `session` ; ce module est la seule source de ces adresses.
 */

export type ScrutinRef = {
  numero: number | string;
  chambre?: string | null;
  session?: string | null;
};

/** Paramètres identifiant un scrutin sans ambiguïté : `chambre` (Assemblée par défaut) et `session`. */
export const scrutinQuery = ({
  chambre,
  session,
}: Pick<ScrutinRef, "chambre" | "session">): Record<string, string> => {
  const params: Record<string, string> = { chambre: chambre || "assemblee" };
  if (session) params.session = session;
  return params;
};

/** `/scrutins/42?chambre=senat&session=2025`. */
export const scrutinHref = (scrutin: ScrutinRef) =>
  `/scrutins/${scrutin.numero}?${new URLSearchParams(scrutinQuery(scrutin)).toString()}`;

/** Fiche d'un parlementaire : `/deputes/:slug` ou `/senateurs/:slug`. */
export const parlementaireHref = (chambre: string | null | undefined, slug: string) =>
  `/${chambre === "senat" ? "senateurs" : "deputes"}/${slug}`;

const ROMAINS: Record<number, string> = {
  11: "XIe",
  12: "XIIe",
  13: "XIIIe",
  14: "XIVe",
  15: "XVe",
  16: "XVIe",
  17: "XVIIe",
  18: "XVIIIe",
  19: "XIXe",
};

/** « XVIIe ». */
export const legislatureRomaine = (numero: number) => ROMAINS[numero] ?? `${numero}e`;

/** « XVIIe législature ». */
export const legislatureLabel = (numero: number) => `${legislatureRomaine(numero)} législature`;

/** Session ordinaire du Sénat, stockée par son année de début : « Session 2025-2026 ». */
export const sessionLabel = (session: string) => {
  const debut = Number(session);
  return Number.isFinite(debut) ? `Session ${debut}-${debut + 1}` : `Session ${session}`;
};

/**
 * Période qui lève l'ambiguïté du numéro : « Session 2025-2026 » au Sénat,
 * « XVIIe législature » à l'Assemblée ; `null` si elle est inconnue.
 */
export const periodeScrutin = (scrutin: {
  chambre: string;
  session?: string | null;
  legislature?: number | null;
}): string | null => {
  if (scrutin.chambre === "senat") return scrutin.session ? sessionLabel(scrutin.session) : null;
  const legislature = scrutin.legislature ?? Number(scrutin.session);
  return Number.isFinite(legislature) && legislature > 0 ? legislatureLabel(legislature) : null;
};

/** Mode de scrutin (comment on vote). */
export const TYPES_VOTE: Record<string, string> = {
  solennel: "Vote solennel",
  ordinaire: "Vote ordinaire",
  motion: "Motion",
};

/** Objet du vote (sur quoi on vote), dans l'ordre des filtres : du plus engageant au plus procédural. */
export const NATURES_VOTE: Record<string, string> = {
  ensemble: "Ensemble du texte",
  article: "Article",
  amendement: "Amendement",
  credits: "Crédits budgétaires",
  motion: "Motion ou procédure",
  declaration: "Déclaration du Gouvernement",
};

/** « 1 scrutin », « 12 scrutins ». */
export const pluriel = (n: number, mot: string, motPluriel = `${mot}s`) =>
  `${n.toLocaleString("fr-FR")} ${n > 1 ? motPluriel : mot}`;
