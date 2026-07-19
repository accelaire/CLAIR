/**
 * Périodes institutionnelles — libellés partagés.
 *
 * Les deux chambres n'ont pas le même axe de temps :
 *  - Assemblée : la **législature** (15, 16, 17). La cohorte EST la période.
 *  - Sénat : la **session** ordinaire (1er oct. → 30 sept.). Le Sénat ne se
 *    renouvelant jamais en entier, une mandature ne décrit pas la chambre à un
 *    instant T — seule une fenêtre de temps le peut.
 *
 * Voir SPEC-MULTI-LEGISLATURES.md (ticket #13).
 */

const LEGISLATURE_ROMAN: Record<number, string> = {
  11: 'XIe',
  12: 'XIIe',
  13: 'XIIIe',
  14: 'XIVe',
  15: 'XVe',
  16: 'XVIe',
  17: 'XVIIe',
  18: 'XVIIIe',
  19: 'XIXe',
};

/** « XVIIe » */
export function legislatureRoman(n: number): string {
  return LEGISLATURE_ROMAN[n] ?? `${n}e`;
}

/** « XVIIe législature » */
export function legislatureLabel(n: number): string {
  return `${legislatureRoman(n)} législature`;
}

/** « Mandature 2023 » (cohorte de renouvellement, Sénat) */
export function mandatureLabel(n: number): string {
  return `Mandature ${n}`;
}

/**
 * Session ordinaire du Sénat. La source stocke l'année de début (« 2024 ») ;
 * on affiche la session à cheval sur deux années civiles (« Session 2024-2025 »).
 */
export function sessionLabel(session: string): string {
  const debut = Number(session);
  if (!Number.isFinite(debut)) return `Session ${session}`;
  return `Session ${debut}-${debut + 1}`;
}

/**
 * Session ordinaire du Sénat contenant une date, exprimée par son année de début
 * (« 2020 »). La session court du 1er octobre au 30 septembre : à partir d'octobre
 * on est dans la session de l'année courante, avant on est encore dans la précédente.
 */
export function sessionForDate(date: Date): string {
  const y = date.getUTCFullYear();
  return String(date.getUTCMonth() >= 9 ? y : y - 1);
}

/**
 * Période d'un scrutin, telle qu'affichable à côté de son numéro.
 *
 * Le numéro de scrutin n'est unique dans aucune des deux chambres (réinitialisé
 * à chaque session au Sénat, à chaque législature à l'Assemblée) : la période
 * est ce qui lève l'ambiguïté. `session` porte la session au Sénat et le numéro
 * de législature à l'Assemblée.
 */
export interface ScrutinPeriodeRef {
  chambre: string;
  session?: string | null;
  legislature?: number | null;
}

/** Libellé complet : « Session 2024-2025 » / « XVIIe législature ». */
export function scrutinPeriodeLabel(scrutin: ScrutinPeriodeRef): string | null {
  if (scrutin.chambre === 'senat') {
    return scrutin.session ? sessionLabel(scrutin.session) : null;
  }
  const legislature = scrutin.legislature ?? Number(scrutin.session);
  return Number.isFinite(legislature) ? legislatureLabel(legislature) : null;
}

/** Version compacte pour les badges de liste : « 2024-2025 » / « XVIIe ». */
export function scrutinPeriodeBadge(scrutin: ScrutinPeriodeRef): string | null {
  if (scrutin.chambre === 'senat') {
    if (!scrutin.session) return null;
    const debut = Number(scrutin.session);
    return Number.isFinite(debut) ? `${debut}-${debut + 1}` : scrutin.session;
  }
  const legislature = scrutin.legislature ?? Number(scrutin.session);
  return Number.isFinite(legislature) ? legislatureRoman(legislature) : null;
}

/** Une période exposée par l'API, telle qu'affichable en raccourci de filtre. */
export interface PeriodePreset {
  key: string;
  /** Intitulé du groupe de raccourcis (« Par législature », « Par session »). */
  groupe: string;
  label: string;
  /** Chambre à laquelle la période appartient : une législature est un concept
   *  Assemblée, une session ordinaire un concept Sénat. Sélectionner la période
   *  restreint donc aussi la chambre, sans quoi le libellé mentirait. */
  chambre: 'assemblee' | 'senat';
  from: Date;
  to: Date;
  count: number;
}

/** Ligne brute renvoyée par `GET /scrutins/periodes`. Bornes au format 'YYYY-MM-DD'. */
export interface PeriodeApi {
  chambre: string;
  legislature: number | null;
  session: string;
  dateDebut: string;
  dateFin: string;
  count: number;
}

/** Parse 'YYYY-MM-DD' en date locale : `new Date(str)` l'interpréterait en UTC
 *  et décalerait le jour d'un cran dans les fuseaux à l'est de Greenwich. */
function parseJourLocal(jour: string): Date {
  const [y, m, d] = jour.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/**
 * Convertit les périodes de l'API en raccourcis de filtre.
 *
 * Les bornes viennent des scrutins réellement en base : sélectionner un
 * raccourci renvoie donc exactement les scrutins de la période, sans avoir à
 * connaître le calendrier institutionnel côté client.
 */
export function toPeriodePresets(rows: PeriodeApi[]): PeriodePreset[] {
  return rows.map((r) => {
    const senat = r.chambre === 'senat';
    return {
      key: `${r.chambre}-${r.session}`,
      groupe: senat ? 'Par session (Sénat)' : 'Par législature (Assemblée)',
      label: senat
        ? sessionLabel(r.session)
        : legislatureLabel(r.legislature ?? Number(r.session)),
      chambre: senat ? ('senat' as const) : ('assemblee' as const),
      from: parseJourLocal(r.dateDebut),
      to: parseJourLocal(r.dateFin),
      count: r.count,
    };
  });
}
