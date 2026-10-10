import { describe, it, expect } from 'vitest';
import { estOpenDataAN, memeVersion, urlSansCacheAN, versionContredite } from './cdn-an';

const AMO10 =
  'https://data.assemblee-nationale.fr/static/openData/repository/17/amo/deputes_actifs_mandats_actifs_organes/AMO10_deputes_actifs_mandats_actifs_organes.json.zip';

describe('urlSansCacheAN', () => {
  it("ajoute un paramètre inédit aux archives du portail open data de l'Assemblée", () => {
    expect(urlSansCacheAN(AMO10, 1791536630518)).toBe(`${AMO10}?_=1791536630518`);
  });

  it('garde les paramètres existants', () => {
    expect(urlSansCacheAN('https://data.assemblee-nationale.fr/a.csv?x=1', 7)).toBe(
      'https://data.assemblee-nationale.fr/a.csv?x=1&_=7',
    );
  });

  it("laisse les autres hôtes intacts, site de l'Assemblée compris", () => {
    const pdf = 'https://www.assemblee-nationale.fr/dyn/17/comptes-rendus/cion_lois/l17cion_lois2526091_compte-rendu.pdf';
    expect(urlSansCacheAN(pdf, 7)).toBe(pdf);
    expect(urlSansCacheAN('https://data.senat.fr/data/ameli/ameli.zip', 7)).toBe('https://data.senat.fr/data/ameli/ameli.zip');
  });

  it('change à chaque appel par défaut', () => {
    expect(urlSansCacheAN(AMO10)).toMatch(/\?_=\d{13}$/);
  });
});

describe('estOpenDataAN', () => {
  it("ne reconnaît que l'hôte exact", () => {
    expect(estOpenDataAN(AMO10)).toBe(true);
    expect(estOpenDataAN('https://data.assemblee-nationale.fr.example.com/x')).toBe(false);
    expect(estOpenDataAN('pas une url')).toBe(false);
  });
});

describe('memeVersion', () => {
  // Dates de l'archive des débats servies le 9 octobre 2026 à 3 h UTC (cache)
  // et publiées par l'origine ; l'ETag de la veille est illustratif.
  const veille = { etag: '"3651343-65d4a1b2c3d4e"', lastModified: 'Thu, 08 Oct 2026 02:06:07 GMT' };
  const jour = { etag: '"3651343-65d5eca0bb88d"', lastModified: 'Fri, 09 Oct 2026 02:05:58 GMT' };

  it("reconnaît un cache qui sert la version de l'origine", () => {
    expect(memeVersion(jour, { ...jour })).toBe(true);
  });

  it('repère un cache qui sert la version de la veille', () => {
    expect(memeVersion(veille, jour)).toBe(false);
  });

  it("se rabat sur Last-Modified sans ETag, et tient pour périmé ce qu'il ne peut comparer", () => {
    expect(memeVersion({ etag: null, lastModified: jour.lastModified }, { etag: null, lastModified: jour.lastModified })).toBe(true);
    expect(memeVersion({ etag: null, lastModified: null }, jour)).toBe(false);
  });
});

describe('versionContredite', () => {
  const veille = { etag: '"368e022-65d4aacc3bb07"', lastModified: 'Thu, 08 Oct 2026 02:06:07 GMT' };
  const jour = { etag: '"368e022-65d72e7f8c21e"', lastModified: 'Sat, 10 Oct 2026 02:05:59 GMT' };

  it("repère une réponse qui porte une autre version que l'origine", () => {
    expect(versionContredite(veille, jour)).toBe(true);
    expect(versionContredite({ etag: null, lastModified: veille.lastModified }, jour)).toBe(true);
  });

  it('accepte la même version', () => {
    expect(versionContredite({ ...jour }, jour)).toBe(false);
  });

  it("ne refuse pas une réponse qu'il ne peut comparer", () => {
    expect(versionContredite({ etag: null, lastModified: null }, jour)).toBe(false);
  });
});
