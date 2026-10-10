import { describe, it, expect } from 'vitest';
import {
  articleConcorde,
  deciderLien,
  numeroDeSeance,
  numeroDuLibelle,
  type AmendementCandidat,
  type LienExamine,
} from './liens-amendements-discordants';

// Scrutin n° 4462 du 3 décembre 2025, nouvelle lecture du PLFSS 2026.
const TITRE =
  "l'amendement n° 848 de M. X à l'article 5 du projet de loi de financement de la sécurité sociale pour 2026 (nouvelle lecture).";
const amdt = (id: string, articleVise: string, texteRef: string, dateDepot: string, dossierId = 'plfss'): AmendementCandidat => ({
  id, numero: '848', articleVise, texteRef, dateDepot: new Date(dateDepot), dossierId,
});
const lien = (l: Partial<LienExamine> = {}): LienExamine => ({
  scrutin: { id: 's', titre: TITRE, date: new Date('2025-12-03T00:00:00Z'), dossierId: 'plfss' },
  amendement: amdt('premiere-lecture', 'APRÈS ART. 7', 'PRJLANR5L17B1907', '2025-10-30'),
  homonymes: [],
  lecturePlusRecente: false,
  ...l,
});

describe('articleConcorde', () => {
  it("reconnaît l'article du libellé, « après » compris", () => {
    expect(articleConcorde(TITRE, 'ART. 5')).toBe(true);
    expect(articleConcorde(TITRE, 'APRÈS ART. 5')).toBe(false);
    expect(articleConcorde(TITRE, 'APRÈS ART. 7')).toBe(false);
    expect(articleConcorde("l'amendement n° 27 à l'article 1er bis de la proposition de loi.", 'ART. 1ER BIS')).toBe(true);
  });

  it('ne compare pas sans article lisible', () => {
    expect(articleConcorde("l'amendement n° 3 au titre de la proposition de loi.", 'ART. 2')).toBeNull();
    expect(articleConcorde(TITRE, null)).toBeNull();
  });
});

describe('numéros', () => {
  it('lit le premier numéro du libellé, sous-amendement compris', () => {
    expect(numeroDuLibelle("le sous-amendement n° 2 de Mme Y à l'amendement n° 1 du Gouvernement")).toBe('2');
    expect(numeroDuLibelle(TITRE)).toBe('848');
  });

  it('ramène les numéros de séance des lois de finances et les rectifications au numéro du libellé', () => {
    expect(numeroDeSeance('I-989')).toBe('989');
    expect(numeroDeSeance('989 (Rect)')).toBe('989');
    expect(numeroDeSeance('I-CF989')).toBe('I-CF989');
  });
});

describe('deciderLien', () => {
  const nouvelleLecture = amdt('nouvelle-lecture', 'ART. 5', 'PRJLANR5L17B2141', '2025-11-29');

  it("remplace par l'unique homonyme du dossier, sur le bon article et déposé avant le vote", () => {
    expect(deciderLien(lien({ homonymes: [nouvelleLecture], lecturePlusRecente: true }))).toEqual({
      action: 'remplacer', par: 'nouvelle-lecture',
    });
  });

  it('ignore un homonyme déposé après le vote', () => {
    const tardif = amdt('tardif', 'ART. 5', 'PRJLANR5L17B2247', '2026-01-09');
    expect(deciderLien(lien({ homonymes: [tardif] })).action).toBe('garder');
  });

  it('retire un lien sur une lecture dépassée, sans remplaçant', () => {
    expect(deciderLien(lien({ lecturePlusRecente: true })).action).toBe('retirer');
  });

  it("retire un lien vers un autre dossier sur un autre article (page AN fautive, scrutin 7375)", () => {
    const autre = amdt('outre-mer', 'ART. PREMIER', 'PIONANR5L17B2415', '2025-11-01', 'outre-mer');
    expect(deciderLien(lien({ amendement: autre })).action).toBe('retirer');
  });

  it("garde une simple convention d'écriture : même dossier, pas de lecture plus récente", () => {
    const apres = amdt('apres', 'APRÈS ART. 5', 'PRJLANR5L17B2141', '2025-11-29');
    expect(deciderLien(lien({ amendement: apres }))).toEqual({ action: 'garder', raison: 'convention d’écriture probable' });
  });

  it('garde quand deux homonymes conviennent : rien ne départage', () => {
    const autre = amdt('autre', 'ART. 5', 'PRJLANR5L17BTC2141', '2025-11-28');
    expect(deciderLien(lien({ homonymes: [nouvelleLecture, autre] })).action).toBe('garder');
  });
});
