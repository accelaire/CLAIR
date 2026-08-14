import { describe, it, expect } from 'vitest';
import {
  normalizeQualite,
  extractMatricules,
  resolveOrganeRef,
  SenatBureauClient,
} from './bureau-client';

// =============================================================================
// normalizeQualite
// =============================================================================

describe('normalizeQualite', () => {
  // Intitulés relevés tels quels sur les 8 pages de bureau en production.
  it.each([
    ['Le Président', 'Président'],
    ['La Présidente', 'Président'],
    ['Les Vice-Présidentes et Vice-Présidents', 'Vice-Président'],
    ['Les Secrétaires', 'Secrétaire'],
    ['Le Rapporteur général', 'Rapporteur général'],
    ['La rapporteure générale', 'Rapporteur général'],
  ])('normalise %s → %s', (heading, expected) => {
    expect(normalizeQualite(heading)).toBe(expected);
  });

  it('classe « vice-président » avant « président » (sous-chaîne piégeuse)', () => {
    expect(normalizeQualite('Les Vice-Présidents')).toBe('Vice-Président');
    expect(normalizeQualite('Vice-président')).not.toBe('Président');
  });

  it('ignore un intitulé hors bureau', () => {
    expect(normalizeQualite('Comptes rendus')).toBeNull();
    expect(normalizeQualite('Actualités de la commission')).toBeNull();
    expect(normalizeQualite('')).toBeNull();
  });
});

// =============================================================================
// extractMatricules
// =============================================================================

describe('extractMatricules', () => {
  it('extrait le matricule et le met en majuscules', () => {
    const html = '<a href="https://www.senat.fr/senateur/perrin_cedric14193x.html">M. Cédric Perrin</a>';
    expect(extractMatricules(html)).toEqual(['14193X']);
  });

  it('gère les noms composés, apostrophes et tirets', () => {
    const html = `
      <a href="/senateur/conway_mouret_helene08015p.html">x</a>
      <a href="/senateur/d_ornano_marie12345a.html">y</a>
      <a href="/senateur/le-gleut_ronan16034r.html">z</a>`;
    expect(extractMatricules(html)).toEqual(['08015P', '12345A', '16034R']);
  });

  it('déduplique', () => {
    const html = `
      <a href="/senateur/perrin_cedric14193x.html">photo</a>
      <a href="/senateur/perrin_cedric14193x.html">nom</a>`;
    expect(extractMatricules(html)).toEqual(['14193X']);
  });

  it('ignore les liens non-sénateur', () => {
    const html = `
      <a href="/travaux-parlementaires/commissions/commission-des-finances.html">x</a>
      <a href="/senimg/perrin_cedric14193x_carre.jpg">img</a>`;
    expect(extractMatricules(html)).toEqual([]);
  });
});

// =============================================================================
// resolveOrganeRef
// =============================================================================

describe('resolveOrganeRef', () => {
  // Bureau réaliste : ~16 membres, dont quelques-uns siègent aussi aux
  // affaires européennes (cumul fréquent au Sénat).
  const codes = new Map<string, Set<string>>();
  const bureauFinances: string[] = [];
  for (let i = 1; i <= 16; i++) {
    const mat = `${String(i).padStart(5, '0')}A`;
    bureauFinances.push(mat);
    codes.set(mat, new Set(i <= 4 ? ['COM-FINC', 'COMEUR-AFEU'] : ['COM-FINC']));
  }

  it('retient le code majoritaire malgré les cumuls', () => {
    const r = resolveOrganeRef(bureauFinances, codes);
    expect(r.organeRef).toBe('COM-FINC');
    expect(r.top).toBe(16);
    expect(r.runnerUp).toBe(4);
  });

  it('tolère un membre dont la donnée amont est incomplète', () => {
    // Cas réel: un membre du bureau des affaires sociales n'a pas COM-SOCI
    // dans ses organismes — l'intersection stricte viderait le résultat.
    codes.set('90000Z', new Set(['COMEUR-AFEU']));
    const r = resolveOrganeRef([...bureauFinances, '90000Z'], codes);
    expect(r.organeRef).toBe('COM-FINC');
  });

  it('refuse de trancher quand la marge est trop faible', () => {
    // Deux codes à égalité : aucune commission ne se dégage.
    const ambigu = new Map<string, Set<string>>([
      ['00001A', new Set(['COM-FINC', 'COM-LOIS'])],
      ['00002B', new Set(['COM-FINC', 'COM-LOIS'])],
    ]);
    expect(resolveOrganeRef(['00001A', '00002B'], ambigu).organeRef).toBeNull();
  });

  it('renvoie null sans membre', () => {
    expect(resolveOrganeRef([], codes).organeRef).toBeNull();
  });

  it('ignore un matricule inconnu du référentiel', () => {
    const r = resolveOrganeRef([...bureauFinances, '99999Z'], codes);
    expect(r.organeRef).toBe('COM-FINC');
    expect(r.top).toBe(16);
  });
});

// =============================================================================
// parseBureauPage
// =============================================================================

describe('parseBureauPage', () => {
  const client = new SenatBureauClient();

  // Structure réelle de senat.fr : une <section> par rôle, chacune portant son
  // <h2> et les cartes sénateur correspondantes.
  const page = `
    <html><body>
      <nav><a href="/compte-rendu-commissions/finances.html">Comptes rendus</a></nav>
      <section class="section">
        <h2>Le Président</h2>
        <div class="card card-senator">
          <img src="/senimg/perrin_cedric14193x_carre.jpg">
          <a href="https://www.senat.fr/senateur/perrin_cedric14193x.html"><span>M. Cédric Perrin</span></a>
        </div>
      </section>
      <section id="c4583">
        <h2>Les Vice-Présidentes et Vice-Présidents</h2>
        <ul>
          <li><a href="https://www.senat.fr/senateur/allizard_pascal14133k.html">M. Pascal Allizard</a></li>
          <li><a href="https://www.senat.fr/senateur/cadic_olivier11055v.html">M. Olivier Cadic</a></li>
        </ul>
      </section>
      <section id="c4584">
        <h2>Les Secrétaires</h2>
        <a href="https://www.senat.fr/senateur/dupont_jean09912m.html">M. Jean Dupont</a>
      </section>
    </body></html>`;

  it('associe chaque rôle à ses sénateurs', () => {
    expect(client.parseBureauPage(page)).toEqual([
      { qualite: 'Président', matricules: ['14193X'] },
      { qualite: 'Vice-Président', matricules: ['14133K', '11055V'] },
      { qualite: 'Secrétaire', matricules: ['09912M'] },
    ]);
  });

  it('ne franchit pas la frontière de section', () => {
    const sections = client.parseBureauPage(page);
    const president = sections.find((s) => s.qualite === 'Président');
    expect(president?.matricules).toHaveLength(1);
  });

  it('ignore les sections sans rôle reconnu', () => {
    const withNoise = page.replace(
      '<h2>Les Secrétaires</h2>',
      '<h2>Actualités</h2>'
    );
    const qualites = client.parseBureauPage(withNoise).map((s) => s.qualite);
    expect(qualites).toEqual(['Président', 'Vice-Président']);
  });

  it('renvoie un tableau vide sur une page sans bureau', () => {
    expect(client.parseBureauPage('<html><body><p>rien</p></body></html>')).toEqual([]);
  });
});
