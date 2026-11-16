/**
 * Fonctions à montrer sous le nom d'un parlementaire : celles qui disent qui dirige l'assemblée,
 * une commission ou un groupe (reprise de `apps/web/lib/fonctions-en-vue.ts`, master c89cfaf).
 * Gérard Larcher, président du Sénat, n'apparaissait comme tel nulle part sur sa fiche (#118).
 */

/** Une fonction d'organe telle que la fiche la reçoit (`mandats` de `/deputes/:slug`). */
export type FonctionEnCours = {
  typeOrgane: string;
  institution: string | null;
  qualite: string | null;
  dateDebut?: string | null;
  dateFin: string | null;
  commission?: { nom: string } | null;
};

/** Une fonction mise en avant, et la date depuis laquelle elle est tenue sans interruption. */
export type FonctionEnVue = { libelle: string; depuis: string | null };

/**
 * Battement toléré entre deux périodes d'une même fonction : le bureau du Sénat est réélu à
 * chaque renouvellement (période close le 1er octobre 2023, suivante ouverte le 2).
 */
const BATTEMENT_MS = 15 * 24 * 3600 * 1000;

const cle = (f: FonctionEnCours): string =>
  [
    f.typeOrgane,
    (f.qualite ?? "").trim().toLowerCase(),
    (f.commission?.nom || f.institution || "").toLowerCase(),
  ].join("|");

/**
 * Début de la fonction en cours, en remontant les périodes qui s'enchaînent : Gérard Larcher
 * préside le Sénat depuis le 1er octobre 2014, pas depuis sa dernière réélection.
 */
const debutContinu = (f: FonctionEnCours, toutes: readonly FonctionEnCours[]): string | null => {
  if (!f.dateDebut) return null;
  const k = cle(f);
  const memes = toutes.flatMap((m) =>
    m !== f && m.dateDebut && m.dateFin && cle(m) === k
      ? [{ debut: m.dateDebut, fin: m.dateFin }]
      : [],
  );
  let debut = f.dateDebut;
  for (;;) {
    const t = Date.parse(debut);
    const precedente = memes.find(({ debut: d, fin }) => {
      const tf = Date.parse(fin);
      return Date.parse(d) < t && tf <= t && t - tf <= BATTEMENT_MS;
    });
    // Jour civil seul : l'API envoie un horodatage (« 2014-10-01T00:00:00.000Z »).
    if (!precedente) return debut.slice(0, 10);
    debut = precedente.debut;
  }
};

const PRESIDENCE = /^présidente?$/i;
const RAPPORTEUR_GENERAL = /^rapporteure? générale?$/i;

/**
 * Commissions dont la présidence se met en avant : permanentes (et affaires européennes au
 * Sénat), d'enquête, spéciales. Les présidences tenues d'office par le président de l'Assemblée
 * (comité d'évaluation, section de l'APF…) encombraient la ligne sous son nom.
 */
const TYPES_COMMISSION = new Set(["COMMISSION", "COMPER", "CNPE", "CNPS"]);

const minusculeInitiale = (s: string): string => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/** « Président » + « Commission des finances » → « Président de la commission des finances ». */
const avecOrgane = (qualite: string, organe: string): string => {
  const o = minusculeInitiale(organe);
  if (o.startsWith("commission") || o.startsWith("délégation")) return `${qualite} de la ${o}`;
  if (o.startsWith("groupe")) return `${qualite} du ${o}`;
  // Autre organe : article élidé devant une voyelle (« de l’office »), « de la » devant les noms
  // féminins usuels ; sinon « de », comme avant.
  if (/^[aeiouyâéèêîôû]/i.test(o)) return `${qualite} de l’${o}`;
  if (/^(mission|section|conférence|cour|haute|délégation)\b/.test(o))
    return `${qualite} de la ${o}`;
  return `${qualite} de ${o}`;
};

/**
 * Libellés des fonctions en cours à mettre en avant, du plus haut rang au plus bas : bureau de
 * l'assemblée, puis présidence et rapport général d'une commission, puis présidence d'un groupe.
 * Les fonctions « d'âge » (doyen qui préside la séance d'ouverture) sont écartées.
 */
export const fonctionsEnVue = (fonctions: readonly FonctionEnCours[]): FonctionEnVue[] => {
  const enCours = fonctions.flatMap((f) => {
    const qualite = f.qualite?.trim();
    return !f.dateFin && qualite && !/d['’]âge/i.test(qualite) ? [{ f, qualite }] : [];
  });
  const enVue = (f: FonctionEnCours, libelle: string): FonctionEnVue => ({
    libelle,
    depuis: debutContinu(f, fonctions),
  });
  const bureau = enCours
    .filter(({ f }) => f.typeOrgane === "BUREAU")
    .map(({ f, qualite }) => enVue(f, qualite));
  const commissions = enCours
    .filter(({ f }) => TYPES_COMMISSION.has(f.typeOrgane))
    .filter(({ qualite }) => PRESIDENCE.test(qualite) || RAPPORTEUR_GENERAL.test(qualite))
    .map(({ f, qualite }) => {
      const organe = f.commission?.nom || f.institution;
      return enVue(f, organe ? avecOrgane(qualite, organe) : qualite);
    });
  const groupes = enCours.flatMap(({ f, qualite }) =>
    f.typeOrgane === "GP" && PRESIDENCE.test(qualite) && f.institution
      ? [enVue(f, avecOrgane(qualite, f.institution))]
      : [],
  );
  // Une même fonction en double (deux sources) : la plus ancienne date l'emporte.
  const parLibelle = new Map<string, FonctionEnVue>();
  for (const f of [...bureau, ...commissions, ...groupes]) {
    const deja = parLibelle.get(f.libelle);
    if (!deja || (f.depuis && (!deja.depuis || f.depuis < deja.depuis))) {
      parLibelle.set(f.libelle, f);
    }
  }
  return [...parLibelle.values()];
};

/** Un titre sous le nom d'un élu : fonction, date de début, lien éventuel. */
export type TitreFiche = {
  titre: string;
  depuis?: string | null;
  lien?: { href: string; libelle: string } | null;
};

/** Le poste au Gouvernement d'abord, puis les fonctions parlementaires. */
export const titresDeLaFiche = (
  gouvernement: {
    titre: string;
    depuis: string;
    gouvernement: { slug: string; nom: string } | null;
  } | null,
  fonctions: readonly FonctionEnVue[],
): TitreFiche[] => {
  const titres: TitreFiche[] = [];
  if (gouvernement) {
    titres.push({
      titre: gouvernement.titre,
      depuis: gouvernement.depuis,
      lien: gouvernement.gouvernement
        ? {
            href: `/gouvernements/${gouvernement.gouvernement.slug}`,
            libelle: `Gouvernement ${gouvernement.gouvernement.nom}`,
          }
        : null,
    });
  }
  for (const f of fonctions) titres.push({ titre: f.libelle, depuis: f.depuis });
  return titres;
};
