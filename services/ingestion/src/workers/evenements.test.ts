// =============================================================================
// Validation de la liste curée d'événements institutionnels.
//
// Le contenu est écrit à la main : c'est exactement là que les fautes se
// glissent (slug dupliqué, période à l'envers, date non parsable, échéance
// présentée comme certaine alors qu'aucun décret n'est paru). Ces tests ne
// touchent pas la base et tournent donc partout.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { EVENEMENTS, type TypeEvenement } from './evenements';

const TYPES_VALIDES: TypeEvenement[] = [
  'election',
  'session',
  'suspension',
  'budget',
  'institution',
];

const FORMAT_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe('EVENEMENTS — intégrité de la liste curée', () => {
  it('a des slugs uniques', () => {
    const slugs = EVENEMENTS.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('a des slugs en kebab-case', () => {
    for (const e of EVENEMENTS) {
      expect(e.slug, e.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("n'utilise que des types connus", () => {
    for (const e of EVENEMENTS) {
      expect(TYPES_VALIDES, e.slug).toContain(e.type);
    }
  });

  it('a des dates au format YYYY-MM-DD et réellement parsables', () => {
    for (const e of EVENEMENTS) {
      expect(e.dateDebut, e.slug).toMatch(FORMAT_DATE);
      expect(Number.isNaN(Date.parse(e.dateDebut)), e.slug).toBe(false);
      // Une date comme 2026-02-31 passe la regex mais dérive au parsing.
      expect(new Date(`${e.dateDebut}T00:00:00Z`).toISOString().slice(0, 10)).toBe(e.dateDebut);

      if (e.dateFin) {
        expect(e.dateFin, e.slug).toMatch(FORMAT_DATE);
        expect(new Date(`${e.dateFin}T00:00:00Z`).toISOString().slice(0, 10)).toBe(e.dateFin);
      }
    }
  });

  it('ne contient aucune période à l’envers', () => {
    for (const e of EVENEMENTS) {
      if (!e.dateFin) continue;
      expect(e.dateFin >= e.dateDebut, `${e.slug} : dateFin < dateDebut`).toBe(true);
    }
  });

  it('cale toute date imprécise sur le 1er du mois', () => {
    // `dateDebut` ne sert alors qu'au tri : la pointer sur un jour arbitraire
    // laisserait croire à une précision qu'on n'a pas.
    for (const e of EVENEMENTS) {
      if (e.datePrecise === false) {
        expect(e.dateDebut.endsWith('-01'), `${e.slug} doit viser le 1er du mois`).toBe(true);
      }
    }
  });

  it('documente au moins une source', () => {
    for (const e of EVENEMENTS) {
      expect(e.sources.length, `${e.slug} sans source`).toBeGreaterThan(0);
      for (const s of e.sources) {
        expect(s.label, `${e.slug} : source sans label`).toBeTruthy();
        // Une URL vide vaut pire que pas d'URL : elle promet un lien mort.
        if (s.url !== undefined) expect(s.url, `${e.slug} : url vide`).toMatch(/^https:\/\//);
      }
    }
  });

  it('ne généralise pas un repère transverse depuis une seule chambre', () => {
    // Un repère sans `chambre` vaut pour l'Assemblée ET le Sénat. Le déduire de
    // la seule publication d'une des deux, c'est généraliser sans preuve : le
    // calendrier de séance est fixé par la conférence des présidents de CHAQUE
    // chambre, et rien ne garantit qu'elles s'alignent.
    //
    // Exception : un texte normatif (Constitution, code, LOLF, règlement)
    // s'impose aux deux par lui-même. La clôture de la session ordinaire au
    // 30 juin découle de l'article 28 — inutile d'aller chercher deux sites.
    const TEXTE_NORMATIF = /Constitution|code|loi organique|LOLF|Règlement|L\.O\./i;

    for (const e of EVENEMENTS) {
      if (e.chambre) continue;
      if (e.type !== 'suspension' && e.type !== 'session') continue;
      if (e.sources.some((s) => !s.url && TEXTE_NORMATIF.test(s.label))) continue;

      const labels = e.sources.map((s) => s.label).join(' ');
      expect(/Assembl/i.test(labels), `${e.slug} : aucune source AN`).toBe(true);
      expect(/Sénat/i.test(labels), `${e.slug} : aucune source Sénat`).toBe(true);
    }
  });

  it('justifie toute date non fixée par décret dans sa description', () => {
    for (const e of EVENEMENTS) {
      if (e.datePrecise === false) {
        expect(e.description, `${e.slug} imprécis sans explication`).toBeTruthy();
      }
    }
  });

  it("n'utilise que des chambres connues", () => {
    for (const e of EVENEMENTS) {
      if (e.chambre) expect(['assemblee', 'senat'], e.slug).toContain(e.chambre);
    }
  });

  it('contient le renouvellement sénatorial du 27 septembre 2026', () => {
    // Repère de non-régression : c'est l'échéance qui motive le chantier.
    const senatoriales = EVENEMENTS.find((e) => e.slug === 'senatoriales-2026');
    expect(senatoriales).toBeDefined();
    expect(senatoriales!.dateDebut).toBe('2026-09-27');
    expect(senatoriales!.datePrecise ?? true).toBe(true);
    expect(senatoriales!.chambre).toBe('senat');
    // 27 septembre 2026 tombe bien un dimanche, comme tout scrutin français.
    expect(new Date('2026-09-27T12:00:00Z').getUTCDay()).toBe(0);
  });

  it('place le dépôt du PLF au premier mardi d’octobre (article 39 LOLF)', () => {
    const plf = EVENEMENTS.find((e) => e.slug === 'depot-plf-2027');
    expect(plf).toBeDefined();
    const date = new Date(`${plf!.dateDebut}T12:00:00Z`);
    expect(date.getUTCDay(), 'doit être un mardi').toBe(2);
    expect(date.getUTCMonth(), 'doit être en octobre').toBe(9);
    expect(date.getUTCDate(), 'doit être le premier mardi').toBeLessThanOrEqual(7);
  });
});
