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
  dateDebut?: string | null;
  dateFin: string | null;
  commission?: { nom: string } | null;
}

/** Une fonction mise en avant, et la date depuis laquelle elle est tenue sans interruption. */
export interface FonctionEnVue {
  libelle: string;
  depuis: string | null;
}

/**
 * Battement toléré entre deux périodes d'une même fonction : le bureau du Sénat
 * est réélu à chaque renouvellement (période close le 1er octobre 2023, suivante
 * ouverte le 2), les commissions aussi.
 */
const BATTEMENT_MS = 15 * 24 * 3600 * 1000;

function cle(f: FonctionEnCours): string {
  return [f.typeOrgane, (f.qualite ?? '').trim().toLowerCase(), (f.commission?.nom || f.institution || '').toLowerCase()].join('|');
}

/**
 * Début de la fonction en cours, en remontant les périodes qui s'enchaînent :
 * Gérard Larcher préside le Sénat depuis le 1er octobre 2014, pas depuis sa
 * dernière réélection au plateau.
 */
function debutContinu(f: FonctionEnCours, toutes: readonly FonctionEnCours[]): string | null {
  if (!f.dateDebut) return null;
  const k = cle(f);
  const memes = toutes.filter((m) => m !== f && m.dateDebut && m.dateFin && cle(m) === k);
  let debut = f.dateDebut;
  for (;;) {
    const t = Date.parse(debut);
    const precedente = memes.find((m) => {
      const fin = Date.parse(m.dateFin!);
      return Date.parse(m.dateDebut!) < t && fin <= t && t - fin <= BATTEMENT_MS;
    });
    // Jour civil seul : l'API envoie un horodatage (« 2014-10-01T00:00:00.000Z »).
    if (!precedente) return debut.slice(0, 10);
    debut = precedente.dateDebut!;
  }
}

const PRESIDENCE = /^présidente?$/i;

/**
 * Commissions dont la présidence se met en avant : permanentes (et affaires
 * européennes au Sénat), d'enquête, spéciales. Les présidences tenues d'office
 * par le président de l'Assemblée (comité d'évaluation, section de l'APF…)
 * encombraient la ligne sous son nom.
 */
const TYPES_COMMISSION = new Set(['COMMISSION', 'COMPER', 'CNPE', 'CNPS']);
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
  return `${qualite} de ${o}`;
}

/**
 * Libellés des fonctions en cours à mettre en avant, du plus haut rang au plus
 * bas : bureau de l'assemblée, puis présidence et rapport général d'une
 * commission, puis présidence d'un groupe. Les fonctions « d'âge » (doyen qui
 * préside la séance d'ouverture) sont provisoires par nature : écartées.
 */
export function fonctionsEnVue(fonctions: readonly FonctionEnCours[]): FonctionEnVue[] {
  const enCours = fonctions.filter((f) => !f.dateFin && f.qualite && !/d['’]âge/i.test(f.qualite));
  const enVue = (f: FonctionEnCours, libelle: string): FonctionEnVue => ({ libelle, depuis: debutContinu(f, fonctions) });
  const bureau = enCours.filter((f) => f.typeOrgane === 'BUREAU').map((f) => enVue(f, f.qualite!.trim()));
  const commissions = enCours
    .filter((f) => TYPES_COMMISSION.has(f.typeOrgane))
    .filter((f) => PRESIDENCE.test(f.qualite!.trim()) || RAPPORTEUR_GENERAL.test(f.qualite!.trim()))
    .map((f) => {
      const organe = f.commission?.nom || f.institution;
      return enVue(f, organe ? avecOrgane(f.qualite!.trim(), organe) : f.qualite!.trim());
    });
  const groupes = enCours
    .filter((f) => f.typeOrgane === 'GP' && PRESIDENCE.test(f.qualite!.trim()) && f.institution)
    .map((f) => enVue(f, avecOrgane(f.qualite!.trim(), f.institution!)));
  // Une même fonction en double (deux sources) : la plus ancienne date l'emporte.
  const parLibelle = new Map<string, FonctionEnVue>();
  for (const f of [...bureau, ...commissions, ...groupes]) {
    const deja = parLibelle.get(f.libelle);
    if (!deja || (f.depuis && (!deja.depuis || f.depuis < deja.depuis))) parLibelle.set(f.libelle, f);
  }
  return [...parLibelle.values()];
}

/** Préside son assemblée (Sénat ou Assemblée nationale) : ne vote pas, par usage. */
export function presideUneAssemblee(fonctions: readonly FonctionEnCours[]): boolean {
  return fonctions.some(
    (f) =>
      !f.dateFin &&
      f.typeOrgane === 'BUREAU' &&
      /^présidente? (du sénat|de l['’]assemblée nationale)$/i.test((f.qualite ?? '').trim()),
  );
}
