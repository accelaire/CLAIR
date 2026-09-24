import { describe, it, expect } from 'vitest';
import { lastmodParlementaire } from './lastmod-parlementaire';

const scrutins = new Map<string, Date>([
  ['assemblee', new Date('2026-07-23T22:27:48Z')],
  ['senat', new Date('2026-07-23T21:57:18Z')],
]);

describe('lastmodParlementaire', () => {
  it('retient la fiche IA quand elle est plus récente que le dernier scrutin', () => {
    const d = lastmodParlementaire(
      { chambre: 'assemblee', iaGeneratedAt: new Date('2026-09-20T19:10:00Z') },
      scrutins,
    );
    expect(d?.toISOString()).toBe('2026-09-20T19:10:00.000Z');
  });

  it('retient le dernier scrutin de SA chambre quand la fiche IA est plus ancienne', () => {
    const d = lastmodParlementaire(
      { chambre: 'senat', iaGeneratedAt: new Date('2026-03-01T00:00:00Z') },
      scrutins,
    );
    expect(d?.toISOString()).toBe('2026-07-23T21:57:18.000Z');
  });

  it("n'emprunte pas la date de l'autre chambre", () => {
    const d = lastmodParlementaire(
      { chambre: 'senat', iaGeneratedAt: null },
      new Map([['assemblee', new Date('2026-09-01T00:00:00Z')]]),
    );
    expect(d).toBeNull();
  });

  it('se contente du dernier scrutin sans fiche IA', () => {
    const d = lastmodParlementaire({ chambre: 'assemblee', iaGeneratedAt: null }, scrutins);
    expect(d?.toISOString()).toBe('2026-07-23T22:27:48.000Z');
  });

  it("renvoie null plutôt qu'une date inventée quand rien n'est connu", () => {
    expect(lastmodParlementaire({ chambre: 'assemblee', iaGeneratedAt: null }, new Map())).toBeNull();
  });

  it('ignore une date invalide', () => {
    const d = lastmodParlementaire(
      { chambre: 'assemblee', iaGeneratedAt: new Date('pas une date') },
      scrutins,
    );
    expect(d?.toISOString()).toBe('2026-07-23T22:27:48.000Z');
  });
});
