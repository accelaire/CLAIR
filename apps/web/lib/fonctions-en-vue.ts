// Fonctions à montrer sous le nom d'un parlementaire : celles qui disent qui
// dirige l'assemblée, une commission ou un groupe.
//
// Gérard Larcher, président du Sénat, n'apparaissait comme tel nulle part sur sa
// fiche (ticket #118) : la fonction n'était pas en base, et rien ne la mettait
// en avant quand elle l'est, ni au Sénat ni à l'Assemblée.

export interface FonctionEnCours {
  typeOrgane: string;
  institution: string | null;
  qualite: string | null;
  dateFin: string | null;
  commission?: { nom: string } | null;
}

const PRESIDENCE = /^présidente?$/i;
const RAPPORTEUR_GENERAL = /^rapporteure? générale?$/i;

/** « Commission des finances » → « commission des finances », pour s'insérer dans une phrase. */
function minusculeInitiale(s: string): string {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/** « Président » + « Commission des finances » → « Président de la commission des finances ». */
function avecOrgane(qualite: string, organe: string): string {
  const o = minusculeInitiale(organe);
  if (o.startsWith('commission') || o.startsWith('délégation')) return `${qualite} de la ${o}`;
  if (o.startsWith('groupe')) return `${qualite} du ${o}`;
  return `${qualite} (${organe})`;
}

/**
 * Libellés des fonctions en cours à mettre en avant, du plus haut rang au plus
 * bas : bureau de l'assemblée, puis présidence et rapport général d'une
 * commission, puis présidence d'un groupe. Les fonctions « d'âge » (doyen qui
 * préside la séance d'ouverture) sont provisoires par nature : écartées.
 */
export function fonctionsEnVue(fonctions: readonly FonctionEnCours[]): string[] {
  const enCours = fonctions.filter((f) => !f.dateFin && f.qualite && !/d['’]âge/i.test(f.qualite));
  const bureau = enCours.filter((f) => f.typeOrgane === 'BUREAU').map((f) => f.qualite!.trim());
  const commissions = enCours
    .filter((f) => f.typeOrgane !== 'BUREAU' && f.typeOrgane !== 'GP')
    .filter((f) => PRESIDENCE.test(f.qualite!.trim()) || RAPPORTEUR_GENERAL.test(f.qualite!.trim()))
    .map((f) => {
      const organe = f.commission?.nom || f.institution;
      return organe ? avecOrgane(f.qualite!.trim(), organe) : f.qualite!.trim();
    });
  const groupes = enCours
    .filter((f) => f.typeOrgane === 'GP' && PRESIDENCE.test(f.qualite!.trim()) && f.institution)
    .map((f) => avecOrgane(f.qualite!.trim(), f.institution!));
  return [...new Set([...bureau, ...commissions, ...groupes])];
}
