import type { PriseDeParoleReunion, ScrutinDeSeance } from "@clair/data";

/**
 * Découpage d'un débat comme la séance l'a mené (reprise de `grouperParSujet` de apps/web) :
 * passages consécutifs de même sujet (texte, article, amendement), dans l'ordre de la séance.
 */
export type PassageDuDebat = {
  cle: string;
  /** Intertitre sans le texte (« Article 2 · Amendement n° 512 »), `null` si rien n'est dit. */
  sousTitre: string | null;
  /** Le texte en discussion, ou son numéro de dépôt. */
  texte: { uid: string | null; titre: string } | null;
  prises: PriseDeParoleReunion[];
};

const libelleArticle = (article: string | null) => {
  const propre = article?.trim() ?? "";
  if (propre.length === 0) return null;
  return /^article\b/i.test(propre) ? propre : `Article ${propre}`;
};

const sousTitreDe = (prise: PriseDeParoleReunion) => {
  const parties: string[] = [];
  const article = libelleArticle(prise.articleVise);
  if (article) parties.push(article);
  const amendements = prise.amendementsVises ?? [];
  if (amendements.length > 0) {
    const numeros = amendements.map((numero) => `n° ${numero}`).join(", ");
    parties.push(`${amendements.length > 1 ? "Amendements" : "Amendement"} ${numeros}`);
  }
  return parties.length > 0 ? parties.join(" · ") : null;
};

const texteDe = (prise: PriseDeParoleReunion) => {
  if (prise.dossier) return { uid: prise.dossier.uid, titre: prise.dossier.titre };
  return prise.texteNumero ? { uid: null, titre: `Texte n° ${prise.texteNumero}` } : null;
};

const cleDuSujet = (prise: PriseDeParoleReunion) =>
  `${prise.dossier?.uid ?? prise.texteNumero ?? ""}|${prise.articleVise ?? ""}|${(prise.amendementsVises ?? []).join(",")}`;

export const grouperParSujet = (prises: PriseDeParoleReunion[]): PassageDuDebat[] => {
  const passages: PassageDuDebat[] = [];
  for (const prise of prises) {
    const cle = cleDuSujet(prise);
    const dernier = passages.at(-1);
    if (dernier?.cle.startsWith(`${cle}#`)) {
      dernier.prises.push(prise);
      continue;
    }
    passages.push({
      cle: `${cle}#${passages.length}`,
      sousTitre: sousTitreDe(prise),
      texte: texteDe(prise),
      prises: [prise],
    });
  }
  return passages;
};

/**
 * Votes à afficher après chaque prise de parole : un vote tombe après la DERNIÈRE prise qui le
 * précède (plusieurs prises débattent souvent du même amendement).
 */
export const votesApres = (prises: PriseDeParoleReunion[], scrutins: ScrutinDeSeance[]) => {
  const parId = new Map(scrutins.map((scrutin) => [scrutin.id, scrutin]));
  const derniere = new Map<string, string>();
  for (const prise of prises) {
    for (const id of prise.scrutinIds) derniere.set(id, prise.id);
  }
  const parPrise = new Map<string, ScrutinDeSeance[]>();
  for (const [scrutinId, priseId] of derniere) {
    const scrutin = parId.get(scrutinId);
    if (scrutin) parPrise.set(priseId, [...(parPrise.get(priseId) ?? []), scrutin]);
  }
  return parPrise;
};
