// Rattachement des fonctions (commissions, groupes d'études, missions…) aux
// mandats parlementaires de la fiche.
//
// La page rangeait toutes les fonctions sous chaque mandat « en cours ». Un
// député élu sénateur voyait la même liste sous ses deux mandats, et ses
// commissions de l'Assemblée sous son mandat de sénateur (Gabriel Amard,
// octobre 2026). Chaque fonction va désormais sous le mandat de sa chambre
// dont la période recouvre la sienne.

type Chambre = 'assemblee' | 'senat';

export interface FonctionRattachable {
  dateDebut: string;
  dateFin: string | null;
  /** `PM…` : mandat d'organe publié par l'Assemblée. */
  sourceUid?: string | null;
  /** `PO…` : organe de l'Assemblée ; `COM-…`, `COMEUR-…` : organes du Sénat. */
  organeRef?: string | null;
}

export interface MandatRattachable {
  chambre?: string;
  dateDebut: string;
  dateFin: string | null;
}

/** Chambre d'une fonction : l'Assemblée publie ses organes en PO… et ses mandats en PM…. */
export function chambreDeLaFonction(f: FonctionRattachable, chambreFiche: Chambre): Chambre {
  if (f.sourceUid?.startsWith('PM') || f.organeRef?.startsWith('PO')) return 'assemblee';
  if (f.organeRef) return 'senat';
  return chambreFiche;
}

const temps = (date: string | null) => (date ? new Date(date).getTime() : Number.POSITIVE_INFINITY);

/**
 * Index du mandat de chaque fonction, ou `null` s'il n'y a aucun mandat.
 *
 * Le mandat retenu est, dans la chambre de la fonction, le plus récent dont la
 * période recouvre la sienne. Le recouvrement, et non « le mandat commencé
 * avant », parce qu'un organe de l'Assemblée commence le jour de l'élection et
 * le mandat le lendemain, à la prise de fonction. Sans recouvrement, on prend
 * le mandat de la même chambre le plus proche dans le temps, puis à défaut le
 * plus récent : aucune fonction ne disparaît de la page.
 */
export function mandatDeChaqueFonction<F extends FonctionRattachable>(
  mandats: MandatRattachable[],
  fonctions: F[],
  chambreFiche: Chambre,
): (number | null)[] {
  if (mandats.length === 0) return fonctions.map(() => null);
  const chambreMandat = (m: MandatRattachable): Chambre =>
    m.chambre === 'assemblee' || m.chambre === 'senat' ? m.chambre : chambreFiche;
  const plusRecent = mandats.reduce((best, m, i) => (temps(m.dateDebut) > temps(mandats[best]!.dateDebut) ? i : best), 0);

  return fonctions.map((f) => {
    const chambre = chambreDeLaFonction(f, chambreFiche);
    const debut = temps(f.dateDebut);
    const fin = temps(f.dateFin);
    let choisi: number | null = null;
    let ecartChoisi = Number.POSITIVE_INFINITY;
    mandats.forEach((m, i) => {
      if (chambreMandat(m) !== chambre) return;
      const mDebut = temps(m.dateDebut);
      const mFin = temps(m.dateFin);
      // Recouvrement : écart nul, départagé par le mandat le plus récent.
      const ecart = debut <= mFin && fin >= mDebut ? 0 : Math.min(Math.abs(debut - mDebut), Math.abs(debut - mFin));
      if (
        ecart < ecartChoisi ||
        (ecart === ecartChoisi && choisi !== null && mDebut > temps(mandats[choisi]!.dateDebut))
      ) {
        choisi = i;
        ecartChoisi = ecart;
      }
    });
    return choisi ?? plusRecent;
  });
}
