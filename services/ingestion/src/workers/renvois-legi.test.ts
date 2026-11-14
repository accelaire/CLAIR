import { describe, it, expect, beforeAll } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  creerResolveur,
  detecterRenvois,
  enVigueur,
  sansChevauchement,
  texteCourant,
  type RenvoiLegi,
  type ResolveurLegi,
} from './renvois-legi';

type Tisseuse = typeof import('@tricoteuses/tisseuse');

const CONSOMMATION = 'LEGITEXT000006069565';
const LME = 'JORFTEXT000019283050';

const TEXTES = [
  {
    id: CONSOMMATION, cid: CONSOMMATION, nature: 'CODE', num: null, dateTexte: null,
    dateDebut: '2016-07-01', dateFin: '2999-01-01', titre: 'Code de la consommation',
  },
  {
    id: 'LEGITEXT000019285163', cid: LME, nature: 'LOI', num: '2008-776', dateTexte: '2008-08-04',
    dateDebut: '2008-08-06', dateFin: '2999-01-01', titre: "LOI n° 2008-776 du 4 août 2008 de modernisation de l'économie (1)",
  },
];

const ARTICLES = [
  // Deux versions de L. 121-1 : la date de dépôt choisit.
  { cid: CONSOMMATION, id: 'LEGIARTI000032227301', num: 'L121-1', dateDebut: '2016-07-01', dateFin: '2021-10-01' },
  { cid: CONSOMMATION, id: 'LEGIARTI000044142344', num: 'L121-1', dateDebut: '2021-10-01', dateFin: '2999-01-01' },
  { cid: CONSOMMATION, id: 'LEGIARTI000032227288', num: 'L111-1', dateDebut: '2016-07-01', dateFin: '2999-01-01' },
  { cid: LME, id: 'LEGIARTI000019284384', num: '51', dateDebut: '2008-08-06', dateFin: '2999-01-01' },
];

/** Base factice : répond aux deux requêtes du résolveur d'après leur texte. */
const db = {
  $queryRaw: async (sql: TemplateStringsArray, ...valeurs: unknown[]) => {
    const requete = sql.join('?');
    if (requete.includes('FROM legi_textes')) return TEXTES;
    const cid = valeurs.find((v) => typeof v === 'string' && /TEXT\d+$/.test(v));
    return ARTICLES.filter((a) => a.cid === cid).map(({ cid: _, ...a }) => a);
  },
} as unknown as PrismaClient;

let t: Tisseuse;
let resolveur: ResolveurLegi;

beforeAll(async () => {
  t = await import('@tricoteuses/tisseuse');
  resolveur = creerResolveur(t, db);
  await resolveur.preloadTextTitlesInfos();
});

const extraits = (texte: string, renvois: RenvoiLegi[]) => renvois.map((r) => texte.slice(r.debut, r.fin));

describe('renvois au droit en vigueur', () => {
  it("relie l'article d'un code à sa version en vigueur à la date de dépôt", async () => {
    const texte = "L'article L. 121‑1 du code de la consommation est ainsi modifié :";
    const avant = await detecterRenvois(t, resolveur, { texte, date: '2019-03-01' });
    const apres = await detecterRenvois(t, resolveur, { texte, date: '2024-03-01' });
    expect(avant).toHaveLength(1);
    expect(avant[0]).toMatchObject({ type: 'article', article: 'LEGIARTI000032227301', cid: CONSOMMATION, nature: 'CODE' });
    expect(apres[0]?.article).toBe('LEGIARTI000044142344');
    // Positions dans le texte d'origine, trait d'union insécable compris.
    expect(extraits(texte, avant)[0]).toContain('L. 121‑1');
  });

  it("relie l'article d'une loi citée par son numéro et sa date", async () => {
    const texte = "au sens de l'article 51 de la loi n° 2008‑776 du 4 août 2008 de modernisation de l'économie";
    const renvois = await detecterRenvois(t, resolveur, { texte, date: '2025-04-04' });
    expect(renvois).toHaveLength(1);
    expect(renvois[0]).toMatchObject({ type: 'article', article: 'LEGIARTI000019284384', cid: LME, nature: 'LOI' });
  });

  it("relie un code cité sans article à son texte", async () => {
    const texte = 'Le code de la consommation est ainsi modifié :';
    const renvois = await detecterRenvois(t, resolveur, { texte, date: '2024-03-01' });
    expect(renvois).toEqual([expect.objectContaining({ type: 'texte', cid: CONSOMMATION, nature: 'CODE' })]);
    expect(extraits(texte, renvois)[0]).toContain('code de la consommation');
  });

  it("ne devine pas le texte d'un article cité seul", async () => {
    const texte = "À l'article L. 121‑1, les mots : « ou » sont supprimés.";
    expect(await detecterRenvois(t, resolveur, { texte, date: '2024-03-01' })).toEqual([]);
  });

  it("lit le texte cité seul dans le code que modifie l'article amendé", async () => {
    const article = 'Le code de la consommation est ainsi modifié :\n1° Au premier alinéa de l’article L. 111‑1, …';
    const contexte = await texteCourant(t, resolveur, article, '2024-03-01');
    expect(contexte?.cid).toBe(CONSOMMATION);
    const texte = "À l'article L. 121‑1, les mots : « ou » sont supprimés.";
    const renvois = await detecterRenvois(t, resolveur, { texte, date: '2024-03-01', contexte });
    expect(renvois).toEqual([expect.objectContaining({ type: 'article', article: 'LEGIARTI000044142344' })]);
  });

  it("ne relie pas un article absent de l'index à la date de dépôt", async () => {
    const texte = "L'article L. 121‑1 du code de la consommation est abrogé.";
    expect(await detecterRenvois(t, resolveur, { texte, date: '2010-01-01' })).toEqual([]);
  });
});

describe('sansChevauchement', () => {
  const r = (debut: number, fin: number, type: RenvoiLegi['type']): RenvoiLegi => ({ debut, fin, type, cid: 'C', nature: null });

  it("garde l'article plutôt que le texte qui le recouvre, et trie par position", () => {
    expect(sansChevauchement([r(30, 40, 'texte'), r(10, 20, 'texte'), r(0, 35, 'article')])).toEqual([
      r(0, 35, 'article'),
    ]);
    expect(sansChevauchement([r(20, 30, 'texte'), r(0, 10, 'article')])).toEqual([r(0, 10, 'article'), r(20, 30, 'texte')]);
  });

  it('accepte deux liens qui se touchent', () => {
    expect(sansChevauchement([r(0, 10, 'article'), r(10, 20, 'article')])).toHaveLength(2);
  });
});

describe('enVigueur', () => {
  it('compte le début et exclut la fin, comme la DILA', () => {
    const v = { dateDebut: '2021-10-01', dateFin: '2024-01-01' };
    expect(enVigueur(v, '2021-10-01')).toBe(true);
    expect(enVigueur(v, '2023-12-31')).toBe(true);
    expect(enVigueur(v, '2024-01-01')).toBe(false);
    expect(enVigueur(v, '2021-09-30')).toBe(false);
  });
});
