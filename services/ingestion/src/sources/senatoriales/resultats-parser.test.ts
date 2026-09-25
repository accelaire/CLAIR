import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  analyserIndex,
  analyserPageCirconscription,
  codeCirconscription,
  lireDecimal,
  lireEntier,
} from './resultats-parser';

// Pages du site de résultats du ministère pour les sénatoriales 2023, archivées
// par la Wayback Machine (licence Etalab 2.0). Le générateur est le même en 2026.
const FIXTURES = path.join(__dirname, '__fixtures__', 'resultats-2023');
const lire = (fichier: string) => readFileSync(path.join(FIXTURES, fichier), 'utf-8');

describe('analyserPageCirconscription — proportionnel (Isère 2023, dimanche 22h20)', () => {
  const page = analyserPageCirconscription(lire('isere-proportionnel.html'));

  it('lit les sièges à pourvoir et un seul tour', () => {
    expect(page.siegesAPourvoir).toBe(5);
    expect(page.tours.map((t) => t.tour)).toEqual([1]);
  });

  it('lit chaque liste avec son numéro de dépôt, ses voix et ses sièges', () => {
    const tour = page.tours[0]!;
    expect(tour.lignes).toHaveLength(9);
    expect(tour.lignes[0]!).toEqual({
      libelle: "L'Isère au Sénat 2023",
      civilite: null,
      nuance: 'LDVD',
      numeroDepot: 1,
      voix: 1215,
      pctInscrits: 38.89,
      pctExprimes: 39.84,
      sieges: 3,
      elu: null,
    });
    expect(tour.lignes[1]!.numeroDepot).toBe(10);
    expect(tour.lignes.reduce((total, l) => total + (l.sieges ?? 0), 0)).toBe(5);
  });

  it('lit la participation, cohérente avec les voix', () => {
    const tour = page.tours[0]!;
    expect(tour.participation).toEqual({
      inscrits: 3124,
      abstentions: 37,
      votants: 3087,
      blancs: 29,
      nuls: 8,
      exprimes: 3050,
    });
    expect(tour.lignes.reduce((total, l) => total + l.voix, 0)).toBe(tour.participation.exprimes);
  });
});

describe('analyserPageCirconscription — majoritaire à deux tours (Orne 2023)', () => {
  const page = analyserPageCirconscription(lire('orne-majoritaire.html'));

  it('lit les deux tours, dans l\'ordre, quel que soit l\'ordre de la page', () => {
    expect(page.siegesAPourvoir).toBe(2);
    expect(page.tours.map((t) => t.tour)).toEqual([1, 2]);
  });

  it('marque l\'élue du 1er tour et l\'élu du 2nd, civilité retirée', () => {
    const premier = page.tours[0]!;
    const second = page.tours[1]!;
    const elusT1 = premier.lignes.filter((l) => l.elu);
    const elusT2 = second.lignes.filter((l) => l.elu);
    expect(elusT1.map((l) => [l.civilite, l.libelle])).toEqual([['Mme', 'Nathalie GOULET']]);
    expect(elusT2.map((l) => [l.civilite, l.libelle])).toEqual([['M.', 'Olivier BITZ']]);
    expect(premier.lignes.every((l) => l.numeroDepot === null && l.sieges === null)).toBe(true);
  });

  it('lit la participation de chaque tour séparément', () => {
    const premier = page.tours[0]!;
    const second = page.tours[1]!;
    expect(premier.participation.votants).toBe(1043);
    expect(second.participation.votants).toBe(1034);
  });

  it('accepte plus de voix que d\'exprimés : chaque bulletin porte jusqu\'à deux noms', () => {
    // Scrutin plurinominal : dans une circonscription à deux sièges, un grand
    // électeur peut voter pour deux candidats. La somme des voix dépasse donc
    // les exprimés, sans jamais dépasser exprimés × sièges.
    const premier = page.tours[0]!;
    const somme = premier.lignes.reduce((total, l) => total + l.voix, 0);
    expect(somme).toBe(1806);
    expect(somme).toBeGreaterThan(premier.participation.exprimes);
    expect(somme).toBeLessThanOrEqual(premier.participation.exprimes * 2);
  });

  it('ne rend que le 1er tour quand le 2nd n\'est pas encore publié', () => {
    const html = lire('orne-majoritaire.html');
    // On retire les deux tableaux du 2nd tour, comme en début d'après-midi.
    const sansSecond = html.replace(
      /<table>\s*<caption[^>]*>\s*Résultats<sup>\*<\/sup>\s*au 2<sup>nd<\/sup> tour[\s\S]*?<\/table>|<table>\s*<caption[^>]*>Mentions 2nd tour<\/caption>[\s\S]*?<\/table>/g,
      ''
    );
    const partielle = analyserPageCirconscription(sansSecond);
    expect(partielle.tours.map((t) => t.tour)).toEqual([1]);
  });
});

describe('analyserPageCirconscription — page sans résultats', () => {
  it('rend une liste de tours vide, sans lever', () => {
    const page = analyserPageCirconscription(
      '<html><body><h4 class="fr-h3">Sièges à pourvoir : 3</h4><p>Rappel candidatures</p></body></html>'
    );
    expect(page).toEqual({ siegesAPourvoir: 3, tours: [] });
  });

  it('lève si des résultats sont publiés sans participation', () => {
    const html = lire('isere-proportionnel.html').replace(/<caption[^>]*>Mentions 1er tour<\/caption>/, '<caption>Autre</caption>');
    expect(() => analyserPageCirconscription(html)).toThrow(/participation/);
  });
});

describe('analyserIndex', () => {
  const entrees = analyserIndex(
    lire('accueil-selecteur.html'),
    'https://www.resultats-elections.interieur.gouv.fr/senatoriales2023/index.html'
  );

  it('lit chaque circonscription avec une URL absolue', () => {
    const isere = entrees.find((e) => e.codeSource === '38');
    expect(isere).toEqual({
      codeSource: '38',
      libelle: 'Isère',
      url: 'https://www.resultats-elections.interieur.gouv.fr/senatoriales2023/ensemble_geographique/84/38/index.html',
    });
  });

  it('retire l\'état « Pourvu T1 » du libellé, et lit l\'étranger et l\'outre-mer', () => {
    expect(entrees.find((e) => e.codeSource === '40')?.libelle).toBe('Landes');
    expect(entrees.find((e) => e.codeSource === 'ZZ')?.url).toMatch(/ensemble_geographique\/\.?\/?ZZ\/index\.html$/);
    expect(entrees.find((e) => e.codeSource === '975')).toBeDefined();
  });
});

describe('codeCirconscription', () => {
  it('ajoute le zéro, traduit l\'étranger et les codes alphabétiques de l\'outre-mer', () => {
    expect(codeCirconscription('1')).toBe('01');
    expect(codeCirconscription('38')).toBe('38');
    expect(codeCirconscription('2A')).toBe('2A');
    expect(codeCirconscription('ZZ')).toBe('997');
    expect(codeCirconscription('ZP')).toBe('987');
    expect(codeCirconscription('987')).toBe('987');
  });
});

describe('nombres à la française', () => {
  it('lit les espaces insécables et les virgules', () => {
    expect(lireEntier('1 215')).toBe(1215);
    expect(lireEntier('3 124')).toBe(3124);
    expect(lireDecimal('38,89')).toBe(38.89);
    expect(lireEntier('')).toBeNull();
  });

  it('refuse un nombre illisible plutôt que d\'écrire zéro', () => {
    expect(() => lireEntier('12a')).toThrow();
    expect(() => lireDecimal('n/a')).toThrow();
  });
});
