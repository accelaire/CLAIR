// =============================================================================
// Tests — dérivation des mandats (multi-législatures AN / multi-mandatures Sénat)
// Voir SPEC-MULTI-LEGISLATURES.md (ticket #13).
//
// Le cœur du sujet : le renouvellement sénatorial du 27 sept. 2026 (série 2) ne
// doit JAMAIS écraser le mandat 2020 d'un sénateur réélu.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  deriveMandatContextAN,
  deriveMandatContextSenat,
  deriveMandatContextSenatOdsen,
  deriveMandatureSenat,
  inferSerieSenatDepuisDate,
  mandatContextANDepuisSource,
  senatMandatFinTheorique,
  senatMandatureDebut,
  isLegislatureCourante,
  upsertMandatParlementaire,
  type MandatContext,
} from './mandats';

// =============================================================================
// Mock Prisma minimal — table `mandatParlementaire` en mémoire.
//
// L'upsert n'utilise que findFirst / findMany / update / create ; le mock couvre
// exactement les clauses `where` employées (égalité de champs, `dateFin: null`,
// `dateFin: { not: null }`, `mandature: { lt }`, `dateDebut: Date`).
// =============================================================================

interface MandatRow {
  id: string;
  personneId: string;
  chambre: string;
  legislature: number | null;
  mandature: number | null;
  serie: string | null;
  dateDebut: Date;
  dateFin: Date | null;
  groupeId: string | null;
  circonscriptionId: string | null;
  commissionPermanente: string | null;
}

function matchWhere(row: MandatRow, where: Record<string, unknown>): boolean {
  for (const [key, cond] of Object.entries(where)) {
    const value = (row as unknown as Record<string, unknown>)[key];
    if (key === 'dateFin') {
      if (cond === null) {
        if (value !== null) return false;
      } else if (cond && typeof cond === 'object' && 'not' in cond) {
        if (value === null) return false; // { not: null }
      }
    } else if (key === 'mandature' && cond && typeof cond === 'object' && 'lt' in cond) {
      const lt = (cond as { lt: number }).lt;
      if (!(row.mandature !== null && row.mandature < lt)) return false;
    } else if (cond instanceof Date) {
      if (!(value instanceof Date) || value.getTime() !== cond.getTime()) return false;
    } else if (value !== cond) {
      return false;
    }
  }
  return true;
}

function makeMockPrisma(seed: Partial<MandatRow>[] = []) {
  let seq = 0;
  const rows: MandatRow[] = seed.map((r) => ({
    id: r.id ?? `seed-${seq++}`,
    personneId: r.personneId ?? 'P',
    chambre: r.chambre ?? 'senat',
    legislature: r.legislature ?? null,
    mandature: r.mandature ?? null,
    serie: r.serie ?? null,
    dateDebut: r.dateDebut ?? new Date('2020-10-01T00:00:00Z'),
    dateFin: r.dateFin ?? null,
    groupeId: r.groupeId ?? null,
    circonscriptionId: r.circonscriptionId ?? null,
    commissionPermanente: r.commissionPermanente ?? null,
  }));

  const prisma = {
    mandatParlementaire: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        rows.find((r) => matchWhere(r, where)) ?? null,
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        rows.filter((r) => matchWhere(r, where)),
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = rows.find((r) => r.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: MandatRow = { ...(data as unknown as MandatRow), id: `new-${seq++}` };
        rows.push(row);
        return row;
      },
    },
  };

  return { prisma: prisma as never, rows };
}

const senatInput = (ctx: MandatContext, extra: Partial<{ groupeId: string }> = {}) => ({
  personneId: 'P',
  chambre: 'senat',
  ctx,
  groupeId: extra.groupeId ?? null,
  circonscriptionId: null,
  commissionPermanente: null,
});

const ctxSenatCourant = (mandature: number | null, dateDebut: string): MandatContext => ({
  legislature: null,
  mandature,
  serie: '2',
  dateDebut: new Date(dateDebut),
  dateFin: null,
});

const ctxSenatClos = (
  mandature: number | null,
  dateDebut: string,
  dateFin: string,
): MandatContext => ({
  legislature: null,
  mandature,
  serie: '2',
  dateDebut: new Date(dateDebut),
  dateFin: new Date(dateFin),
});

describe('Sénat — calendrier des renouvellements', () => {
  it('place la prise de fonction au 1er octobre', () => {
    expect(senatMandatureDebut(2026).toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('clôt un mandat à la veille du renouvellement suivant de sa série (6 ans)', () => {
    // Mandat ouvert en 2020 → fin de droit le 30 sept. 2026 (veille du 1er oct. 2026).
    expect(senatMandatFinTheorique(2020).toISOString()).toBe('2026-09-30T00:00:00.000Z');
    expect(senatMandatFinTheorique(2023).toISOString()).toBe('2029-09-30T00:00:00.000Z');
  });
});

describe('deriveMandatureSenat', () => {
  it("dérive la mandature courante de chaque série à aujourd'hui", () => {
    const aujourdhui = new Date('2026-07-14T00:00:00Z');
    expect(deriveMandatureSenat('1', aujourdhui)).toBe(2023);
    expect(deriveMandatureSenat('2', aujourdhui)).toBe(2020);
  });

  it('ne bascule PAS la série 2 avant la prise de fonction du 1er oct. 2026', () => {
    expect(deriveMandatureSenat('2', new Date('2026-09-30T23:59:59Z'))).toBe(2020);
  });

  it('bascule la série 2 sur la mandature 2026 dès la prise de fonction', () => {
    expect(deriveMandatureSenat('2', new Date('2026-10-01T00:00:00Z'))).toBe(2026);
    expect(deriveMandatureSenat('2', new Date('2026-10-02T00:00:00Z'))).toBe(2026);
  });

  it("laisse la série 1 intacte au renouvellement de la série 2 (renouvellement par moitiés)", () => {
    expect(deriveMandatureSenat('1', new Date('2026-10-02T00:00:00Z'))).toBe(2023);
  });

  it('gère le renouvellement suivant de la série 1 (2029)', () => {
    expect(deriveMandatureSenat('1', new Date('2029-10-02T00:00:00Z'))).toBe(2029);
    expect(deriveMandatureSenat('2', new Date('2029-10-02T00:00:00Z'))).toBe(2026);
  });

  it('recule correctement sur une date antérieure à l’ancre', () => {
    expect(deriveMandatureSenat('1', new Date('2018-01-01T00:00:00Z'))).toBe(2017);
    expect(deriveMandatureSenat('2', new Date('2018-01-01T00:00:00Z'))).toBe(2014);
  });

  it('renvoie null pour la série 3 (héritage pré-2011) et pour une série absente', () => {
    expect(deriveMandatureSenat('3', new Date('2026-07-14T00:00:00Z'))).toBeNull();
    expect(deriveMandatureSenat(null)).toBeNull();
  });
});

describe('deriveMandatContextSenat', () => {
  it('ouvre le mandat courant (dateFin null) et le date au 1er octobre de la mandature', () => {
    const ctx = deriveMandatContextSenat('2', new Date('2026-07-14T00:00:00Z'));
    expect(ctx).toMatchObject({ legislature: null, mandature: 2020, serie: '2', dateFin: null });
    expect(ctx.dateDebut.toISOString()).toBe('2020-10-01T00:00:00.000Z');
  });

  it('produit une mandature DIFFÉRENTE après le renouvellement 2026 → nouveau mandat, pas un écrasement', () => {
    const avant = deriveMandatContextSenat('2', new Date('2026-09-01T00:00:00Z'));
    const apres = deriveMandatContextSenat('2', new Date('2026-10-02T00:00:00Z'));

    // Clé naturelle du mandat = [personne, chambre, legislature, mandature].
    // La mandature change → l'upsert créera une NOUVELLE ligne au lieu d'écraser.
    expect(avant.mandature).toBe(2020);
    expect(apres.mandature).toBe(2026);
    expect(apres.mandature).not.toBe(avant.mandature);
    expect(apres.dateDebut.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });
});

describe('inferSerieSenatDepuisDate (anciens sénateurs, série absente de la source)', () => {
  it('infère la série d’un mandat plein (prise de fonction 1er-3 octobre d’un renouvellement)', () => {
    expect(inferSerieSenatDepuisDate(new Date('2017-10-01T00:00:00Z'))).toBe('1');
    expect(inferSerieSenatDepuisDate(new Date('2017-10-02T00:00:00Z'))).toBe('1'); // 1re séance le 2 oct.
    expect(inferSerieSenatDepuisDate(new Date('2023-10-01T00:00:00Z'))).toBe('1');
    expect(inferSerieSenatDepuisDate(new Date('2020-10-01T00:00:00Z'))).toBe('2');
    expect(inferSerieSenatDepuisDate(new Date('2014-10-01T00:00:00Z'))).toBe('2');
  });

  it('renvoie null pour un début qui n’est pas une prise de fonction de renouvellement', () => {
    expect(inferSerieSenatDepuisDate(new Date('2019-03-15T00:00:00Z'))).toBeNull(); // remplacement
    expect(inferSerieSenatDepuisDate(new Date('2017-10-20T00:00:00Z'))).toBeNull(); // trop tard en oct.
    expect(inferSerieSenatDepuisDate(new Date('2018-10-01T00:00:00Z'))).toBeNull(); // pas une année de renouvellement
  });
});

describe('deriveMandatContextSenatOdsen (dates réelles ODSEN + correction fraîcheur ELUSEN)', () => {
  const maintenant = new Date('2026-07-14T00:00:00Z');

  it('conserve une date de fin réelle telle quelle', () => {
    const ctx = deriveMandatContextSenatOdsen(
      { dateDebut: new Date('2014-10-01T00:00:00Z'), dateFin: new Date('2020-09-30T00:00:00Z'), serie: '2' },
      maintenant,
    );
    expect(ctx).toMatchObject({ legislature: null, mandature: 2014, serie: '2' });
    expect(ctx.dateFin?.toISOString()).toBe('2020-09-30T00:00:00.000Z');
  });

  it('normalise une fin tombant sur un renouvellement (1er oct.) à la veille (30 sept.)', () => {
    // Convention Sénat : la fin réelle du sortant = la prise de fonction de l'entrant.
    const ctx = deriveMandatContextSenatOdsen(
      { dateDebut: new Date('2017-10-01T00:00:00Z'), dateFin: new Date('2023-10-01T00:00:00Z'), serie: '1' },
      maintenant,
    );
    expect(ctx.dateFin?.toISOString()).toBe('2023-09-30T00:00:00.000Z');
  });

  it('CLÔT un mandat série 1 « ouvert » périmé (export figé avant sept. 2023) à sa fin de droit', () => {
    // ELUSEN montre le mandat 2017 encore ouvert ; il s'est en réalité terminé le 30 sept. 2023.
    const ctx = deriveMandatContextSenatOdsen(
      { dateDebut: new Date('2017-10-01T00:00:00Z'), dateFin: null, serie: '1' },
      maintenant,
    );
    expect(ctx.mandature).toBe(2017);
    expect(ctx.dateFin?.toISOString()).toBe('2023-09-30T00:00:00.000Z');
  });

  it('laisse ouvert le mandat de la mandature COURANTE (série 2, 2020)', () => {
    const ctx = deriveMandatContextSenatOdsen(
      { dateDebut: new Date('2020-10-01T00:00:00Z'), dateFin: null, serie: '2' },
      maintenant,
    );
    expect(ctx.mandature).toBe(2020);
    expect(ctx.dateFin).toBeNull();
  });

  it('série inconnue : mandature stable via le renouvellement série-indépendant (pas l’année brute)', () => {
    // Remplacement au 1er oct. 2021 (hors année de renouvellement) → cohorte 2020, PAS 2021.
    const ctx = deriveMandatContextSenatOdsen(
      { dateDebut: new Date('2021-10-01T00:00:00Z'), dateFin: new Date('2024-08-16T00:00:00Z'), serie: null },
      maintenant,
    );
    expect(ctx.mandature).toBe(2020);
  });

  it('rattache un remplacement en cours de mandat à sa cohorte (renouvellement précédent)', () => {
    // Remplacement démarré le 15 mars 2019 → cohorte (mandature) 2017, date réelle conservée.
    const ctx = deriveMandatContextSenatOdsen(
      { dateDebut: new Date('2019-03-15T00:00:00Z'), dateFin: new Date('2023-09-30T00:00:00Z'), serie: '1' },
      maintenant,
    );
    expect(ctx.mandature).toBe(2017);
    expect(ctx.dateDebut.toISOString()).toBe('2019-03-15T00:00:00.000Z'); // date RÉELLE conservée
  });

  it('série inconnue : mandature = année de début et mandat ouvert clos à sa fin de droit', () => {
    const ctx = deriveMandatContextSenatOdsen(
      { dateDebut: new Date('2017-10-01T00:00:00Z'), dateFin: null, serie: null },
      maintenant,
    );
    expect(ctx.mandature).toBe(2017);
    expect(ctx.dateFin?.toISOString()).toBe('2023-09-30T00:00:00.000Z');
  });
});

describe('AN — législatures (non-régression)', () => {
  it('dérive les bornes des législatures', () => {
    expect(deriveMandatContextAN(17)).toMatchObject({ legislature: 17, mandature: null, dateFin: null });
    expect(deriveMandatContextAN(16).dateFin?.toISOString()).toBe('2024-06-09T00:00:00.000Z');
  });

  it('identifie la législature courante', () => {
    expect(isLegislatureCourante(17)).toBe(true);
    expect(isLegislatureCourante(16)).toBe(false);
  });
});

describe('mandatContextANDepuisSource (dates réelles du mandat AN vs bornes de législature)', () => {
  const at = new Date('2026-07-14T00:00:00Z');

  it('surcharge les bornes de législature par les vraies dates du mandat source', () => {
    // Député 15e parti le 1er oct. 2019 : dateFin réelle, pas la fin de législature.
    const ctx = mandatContextANDepuisSource(
      deriveMandatContextAN(15),
      new Date('2017-06-21T00:00:00Z'),
      new Date('2019-10-01T00:00:00Z'),
      at,
    );
    expect(ctx.dateDebut.toISOString()).toBe('2017-06-21T00:00:00.000Z');
    expect(ctx.dateFin?.toISOString()).toBe('2019-10-01T00:00:00.000Z');
  });

  it('retombe sur les bornes de législature quand la source ne fournit pas de dates', () => {
    const ctx = mandatContextANDepuisSource(deriveMandatContextAN(15), null, null, at);
    expect(ctx.dateDebut.toISOString()).toBe('2017-06-21T00:00:00.000Z');
    expect(ctx.dateFin?.toISOString()).toBe('2022-06-21T00:00:00.000Z'); // fin 15e
  });

  it('garde la fin de législature quand le mandat historique n’a pas de dateFin source', () => {
    const ctx = mandatContextANDepuisSource(
      deriveMandatContextAN(16),
      new Date('2022-06-22T00:00:00Z'),
      null,
      at,
    );
    expect(ctx.dateFin?.toISOString()).toBe('2024-06-09T00:00:00.000Z'); // dissolution 16e
  });

  it('laisse le mandat courant ouvert (dateFin null) tout en datant l’entrée réelle', () => {
    const ctx = mandatContextANDepuisSource(
      deriveMandatContextAN(17),
      new Date('2024-09-01T00:00:00Z'), // entrée en cours de législature (remplaçant)
      null,
      at,
    );
    expect(ctx.dateDebut.toISOString()).toBe('2024-09-01T00:00:00.000Z');
    expect(ctx.dateFin).toBeNull();
  });

  it('ignore une date source aberrante (avant 1958 ou trop loin dans le futur) au profit du fallback', () => {
    const ctx = mandatContextANDepuisSource(
      deriveMandatContextAN(15),
      new Date('1900-01-01T00:00:00Z'), // aberrante → fallback début 15e
      new Date('2999-01-01T00:00:00Z'), // aberrante → fallback fin 15e
      at,
    );
    expect(ctx.dateDebut.toISOString()).toBe('2017-06-21T00:00:00.000Z');
    expect(ctx.dateFin?.toISOString()).toBe('2022-06-21T00:00:00.000Z');
  });
});

describe('upsertMandatParlementaire — AN (match par personne+législature)', () => {
  it('réécrit les dates du mandat existant (idempotent depuis la source), mandature ignorée', async () => {
    const { prisma, rows } = makeMockPrisma([
      {
        personneId: 'P',
        chambre: 'assemblee',
        legislature: 15,
        dateDebut: new Date('2017-06-21T00:00:00Z'),
        dateFin: new Date('2022-06-21T00:00:00Z'),
      },
    ]);
    const ctx: MandatContext = {
      legislature: 15,
      mandature: null,
      serie: null,
      dateDebut: new Date('2017-06-21T00:00:00Z'),
      dateFin: new Date('2019-10-01T00:00:00Z'), // vraie fin (départ anticipé)
    };
    const { created } = await upsertMandatParlementaire(prisma, {
      personneId: 'P',
      chambre: 'assemblee',
      ctx,
      groupeId: 'g',
      circonscriptionId: null,
      commissionPermanente: null,
    });
    expect(created).toBe(false);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.dateFin?.toISOString()).toBe('2019-10-01T00:00:00.000Z');
  });
});

describe('upsertMandatParlementaire — Sénat chemin SYNC (mandat courant, dateFin null)', () => {
  it('retour de ministre : crée une NOUVELLE ligne ouverte sans toucher la close, débutant le lendemain', async () => {
    // Sénateur élu 2020, parti au gouvernement (mandat CLOS le 16 août 2024), de retour.
    const { prisma, rows } = makeMockPrisma([
      {
        id: 'clos',
        mandature: 2020,
        dateDebut: new Date('2020-10-01T00:00:00Z'),
        dateFin: new Date('2024-08-16T00:00:00Z'),
        groupeId: 'g-epoque',
      },
    ]);
    const { created } = await upsertMandatParlementaire(
      prisma,
      senatInput(ctxSenatCourant(2020, '2020-10-01T00:00:00Z'), { groupeId: 'g-actuel' }),
    );
    expect(created).toBe(true);
    expect(rows).toHaveLength(2);

    const clos = rows.find((r) => r.id === 'clos')!;
    expect(clos.dateFin?.toISOString()).toBe('2024-08-16T00:00:00.000Z'); // close intacte
    expect(clos.groupeId).toBe('g-epoque');

    const ouvert = rows.find((r) => r.id !== 'clos')!;
    expect(ouvert.dateFin).toBeNull();
    expect(ouvert.dateDebut.toISOString()).toBe('2024-08-17T00:00:00.000Z'); // lendemain de la fin close
    expect(ouvert.groupeId).toBe('g-actuel');
  });

  it('mandat ouvert existant : rafraîchit groupe/mandature SANS écraser dateDebut/dateFin', async () => {
    // dateDebut raffinée par ODSEN (remplaçant entré en cours de mandature).
    const { prisma, rows } = makeMockPrisma([
      {
        id: 'ouvert',
        mandature: 2020,
        dateDebut: new Date('2020-11-05T00:00:00Z'),
        dateFin: null,
        groupeId: 'g-old',
      },
    ]);
    const { created } = await upsertMandatParlementaire(
      prisma,
      senatInput(ctxSenatCourant(2020, '2020-10-01T00:00:00Z'), { groupeId: 'g-new' }),
    );
    expect(created).toBe(false);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.dateDebut.toISOString()).toBe('2020-11-05T00:00:00.000Z'); // inchangée
    expect(rows[0]!.dateFin).toBeNull();
    expect(rows[0]!.groupeId).toBe('g-new');
  });

  it('renouvellement : clôt l’ancien mandat à sa fin de droit et ouvre le nouveau', async () => {
    const { prisma, rows } = makeMockPrisma([
      {
        id: 'ouvert-2020',
        mandature: 2020,
        dateDebut: new Date('2020-10-01T00:00:00Z'),
        dateFin: null,
      },
    ]);
    const { created } = await upsertMandatParlementaire(
      prisma,
      senatInput(ctxSenatCourant(2026, '2026-10-01T00:00:00Z')),
    );
    expect(created).toBe(true);
    expect(rows).toHaveLength(2);

    const ancien = rows.find((r) => r.id === 'ouvert-2020')!;
    expect(ancien.dateFin?.toISOString()).toBe('2026-09-30T00:00:00.000Z'); // fin de droit 2020

    const nouveau = rows.find((r) => r.id !== 'ouvert-2020')!;
    expect(nouveau.mandature).toBe(2026);
    expect(nouveau.dateFin).toBeNull();
    expect(nouveau.dateDebut.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });
});

describe('upsertMandatParlementaire — Sénat chemin ODSEN (mandat clos, dateFin non null)', () => {
  it('ne matche JAMAIS une ligne ouverte : crée une nouvelle ligne close', async () => {
    const { prisma, rows } = makeMockPrisma([
      { id: 'ouvert', mandature: 2020, dateDebut: new Date('2020-10-01T00:00:00Z'), dateFin: null },
    ]);
    const { created } = await upsertMandatParlementaire(
      prisma,
      senatInput(ctxSenatClos(2020, '2020-10-01T00:00:00Z', '2026-09-30T00:00:00Z')),
    );
    expect(created).toBe(true);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === 'ouvert')!.dateFin).toBeNull(); // ligne ouverte intacte
  });

  it('matche une ligne close par sa date de début et met à jour son contexte', async () => {
    const { prisma, rows } = makeMockPrisma([
      {
        id: 'clos',
        mandature: 2017,
        dateDebut: new Date('2017-10-01T00:00:00Z'),
        dateFin: new Date('2023-09-30T00:00:00Z'),
        groupeId: 'g1',
      },
    ]);
    const ctx = ctxSenatClos(2017, '2017-10-01T00:00:00Z', '2023-09-30T00:00:00Z');
    const { created } = await upsertMandatParlementaire(
      prisma,
      senatInput(ctx, { groupeId: 'g2' }),
    );
    expect(created).toBe(false);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.groupeId).toBe('g2');
  });
});
