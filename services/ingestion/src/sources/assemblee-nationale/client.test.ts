import { describe, it, expect } from 'vitest';
import { AssembleeNationaleClient, type ANAmendementFile } from './client';

// Extraits de l'archive Amendements.json.zip de la 17e législature (relevé du
// 18/10/2026), réduits aux champs que lit transformAmendement.
const NIL = { '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance', '@xsi:nil': 'true' };

const base = (uid: string): ANAmendementFile['amendement'] => ({
  uid,
  legislature: '17',
  identification: { numeroLong: '3', numeroOrdreDepot: '3' },
  texteLegislatifRef: 'PIONANR5L17B2892',
});

const client = new AssembleeNationaleClient(17);

describe('transformAmendement : métadonnées de séance', () => {
  it('lit alinéa, discussions, ordre d’appel et chronotag', () => {
    const t = client.transformAmendement({
      ...base('AMANR5L17PO420120B2892P0D1N000003'),
      chronotag: '1791363601460',
      triAmendement: 'baaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaafl',
      amendementParentRef: NIL,
      seanceDiscussionRef: NIL,
      discussionCommune: { idDiscussion: '41035', typePosition: 'Milieu' },
      discussionIdentique: { idDiscussion: '93105', typePosition: 'Premier' },
      pointeurFragmentTexte: {
        amendementStandard: { alinea: { avant_A_Apres: 'Apres', numero: '3', alineaDesignation: 'Après l\'alinéa 3' } },
      },
    });
    expect(t).toMatchObject({
      alinea: 'Après l\'alinéa 3',
      alineaNumero: 3,
      idDiscussionCommune: '41035',
      positionDiscussionCommune: 'Milieu',
      idDiscussionIdentique: '93105',
      positionDiscussionIdentique: 'Premier',
      triAmendement: 'baaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaafl',
      seanceDiscussionRef: null,
      amendementParentRef: null,
    });
    expect(t.chronotag?.toISOString()).toBe('2026-10-07T09:00:01.460Z');
  });

  it('lit le parent d’un sous-amendement et sa séance de discussion', () => {
    const t = client.transformAmendement({
      ...base('AMANR5L17PO838901BTC2765P0D1N002418'),
      chronotag: '1779824968678',
      amendementParentRef: 'AMANR5L17PO838901BTC2765P0D1N000662',
      seanceDiscussionRef: 'RUANR5L17S2026IDS30612',
      discussionCommune: NIL,
      discussionIdentique: NIL,
    });
    expect(t).toMatchObject({
      amendementParentRef: 'AMANR5L17PO838901BTC2765P0D1N000662',
      seanceDiscussionRef: 'RUANR5L17S2026IDS30612',
      idDiscussionCommune: null,
      positionDiscussionCommune: null,
      idDiscussionIdentique: null,
      alinea: null,
      alineaNumero: null,
    });
  });

  it('rend null ce que l’archive marque @xsi:nil ou omet', () => {
    const t = client.transformAmendement({
      ...base('AMANR5L17PO420120B2892P0D1N000004'),
      triAmendement: NIL,
      pointeurFragmentTexte: { amendementStandard: { alinea: NIL } },
    });
    expect(t).toMatchObject({ triAmendement: null, chronotag: null, alinea: null, alineaNumero: null });
  });

  it('garde le libellé mais pas de numéro quand celui-ci n’est pas un entier', () => {
    const t = client.transformAmendement({
      ...base('AMANR5L17PO420120B2892P0D1N000005'),
      pointeurFragmentTexte: { amendementStandard: { alinea: { numero: NIL, alineaDesignation: 'Alinéa 4' } } },
    });
    expect(t).toMatchObject({ alinea: 'Alinéa 4', alineaNumero: null });
  });
});
