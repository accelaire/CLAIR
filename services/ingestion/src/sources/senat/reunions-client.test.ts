import { describe, it, expect } from 'vitest';
import {
  extractCompteRenduLinks,
  extractMatriculesFromCompteRendu,
} from './reunions-client';

// =============================================================================
// extractCompteRenduLinks
// =============================================================================

describe('extractCompteRenduLinks', () => {
  // Extrait réel de la page d'index des affaires étrangères : le slug
  // hebdomadaire varie (etra / etrang / etran) pour une même commission.
  const index = `
    <ul>
      <li><a href="/compte-rendu-commissions/20251006/etra.html">6 octobre 2025</a></li>
      <li><a href="/compte-rendu-commissions/20251020/etrang.html">20 octobre 2025</a></li>
      <li><a href="/compte-rendu-commissions/20260202/etran.html">2 février 2026</a></li>
    </ul>`;

  it('extrait la date depuis l\'URL, quel que soit le slug', () => {
    expect(extractCompteRenduLinks(index, 'COM-ETRD')).toEqual([
      {
        organeRef: 'COM-ETRD',
        date: '2025-10-06',
        url: 'https://www.senat.fr/compte-rendu-commissions/20251006/etra.html',
      },
      {
        organeRef: 'COM-ETRD',
        date: '2025-10-20',
        url: 'https://www.senat.fr/compte-rendu-commissions/20251020/etrang.html',
      },
      {
        organeRef: 'COM-ETRD',
        date: '2026-02-02',
        url: 'https://www.senat.fr/compte-rendu-commissions/20260202/etran.html',
      },
    ]);
  });

  it('déduplique les liens répétés', () => {
    const html = index + index;
    expect(extractCompteRenduLinks(html, 'COM-ETRD')).toHaveLength(3);
  });

  it('ignore les liens hors comptes rendus', () => {
    const html = `
      <a href="/travaux-parlementaires/commissions/commission-des-lois.html">Commission</a>
      <a href="/compte-rendu-commissions/affaires-etrangeres.html">Index</a>`;
    expect(extractCompteRenduLinks(html, 'COM-ETRD')).toEqual([]);
  });

  it('renvoie un tableau vide sur une page sans lien', () => {
    expect(extractCompteRenduLinks('<html></html>', 'COM-LOIS')).toEqual([]);
  });

  it('propage l\'organeRef fourni', () => {
    const r = extractCompteRenduLinks(index, 'COM-FINC');
    expect(r.every((x) => x.organeRef === 'COM-FINC')).toBe(true);
  });
});

// =============================================================================
// extractMatriculesFromCompteRendu
// =============================================================================

describe('extractMatriculesFromCompteRendu', () => {
  it('extrait les matricules et les met en majuscules', () => {
    const html = `
      <a href="/senateur/perrin_cedric14193x.html">M. Cédric Perrin</a>
      <a href="/senateur/jourda_muriel19447x.html">Mme Muriel Jourda</a>`;
    expect(extractMatriculesFromCompteRendu(html)).toEqual(['14193X', '19447X']);
  });

  it('gère les noms composés et les apostrophes', () => {
    const html = `
      <a href="/senateur/briante_guillemont_sophie21404g.html">x</a>
      <a href="/senateur/d_ornano_marie12345a.html">y</a>`;
    expect(extractMatriculesFromCompteRendu(html)).toEqual(['21404G', '12345A']);
  });

  it('déduplique un sénateur cité plusieurs fois', () => {
    const html = `
      <a href="/senateur/perrin_cedric14193x.html">1</a>
      <a href="/senateur/perrin_cedric14193x.html">2</a>
      <a href="/senateur/perrin_cedric14193x.html">3</a>`;
    expect(extractMatriculesFromCompteRendu(html)).toEqual(['14193X']);
  });

  it('ignore les images et les liens non-sénateur', () => {
    const html = `
      <img src="/senimg/perrin_cedric14193x_carre.jpg">
      <a href="/compte-rendu-commissions/20260629/lois.html">CR</a>`;
    expect(extractMatriculesFromCompteRendu(html)).toEqual([]);
  });

  it('renvoie un tableau vide sur un compte rendu sans lien sénateur', () => {
    expect(extractMatriculesFromCompteRendu('<p>Réunion tenue à huis clos.</p>')).toEqual([]);
  });
});
