import { describe, it, expect } from 'vitest';
import { depotsSenat } from './dosleg-depots';
import type { LigneDump } from './sens-client';

const t = (o: Record<string, LigneDump[]>) => new Map(Object.entries(o));

const ORITXT = [
  { oritxtcod: '1', oriordre: '0', oritxtado: 'N' }, // déposé au Sénat
  { oritxtcod: '29', oriordre: '2', oritxtado: 'O' }, // de la commission
  { oritxtcod: '11', oriordre: '1', oritxtado: 'O' }, // adopté par le Sénat
  { oritxtcod: '9', oriordre: '1', oritxtado: 'D' }, // adopté définitivement par le Sénat
  { oritxtcod: '15', oriordre: '1', oritxtado: 'N' }, // retiré par son auteur
];

function dump(textesSuivants: Array<{ texcod: string; oritxtcod: string }>, typloicod = 'pjl', date = '2026-09-16 00:00:00') {
  return t({
    loi: [{ loicod: 'L1', typloicod, signet: 'pjl25-952', etaloicod: '01', loient: 'Réparation des dommages', loitit: null, loiint: 'Projet de loi relatif à la réparation des dommages' }],
    lecture: [{ lecidt: 'LE1', loicod: 'L1' }],
    lecass: [{ lecassidt: 'LA1', lecidt: 'LE1' }],
    texte: [{ texcod: '100', lecassidt: 'LA1', oritxtcod: '1', txtoritxtdat: date }, ...textesSuivants.map((x) => ({ ...x, lecassidt: 'LA1', txtoritxtdat: '2026-10-01 00:00:00' }))],
    oritxt: ORITXT,
    ecr: [
      { texcod: '100', autcod: 'A2', ecrnumtri: '2' },
      { texcod: '100', autcod: 'A1', ecrnumtri: '1' },
      { texcod: '100', autcod: 'S1', ecrnumtri: '3' },
    ],
    auteur: [
      { autcod: 'A1', typautcod: '4  ', prenom: 'Laurent', nomuse: 'NUNEZ', autfct: "ministre de l'intérieur" },
      { autcod: 'A2', typautcod: '4  ', prenom: 'Gérald', nomuse: 'DARMANIN', autfct: 'garde des sceaux, ministre de la justice' },
      { autcod: 'S1', typautcod: '1  ', prenom: 'Un', nomuse: 'SÉNATEUR', autfct: null },
    ],
  });
}

describe('depotsSenat', () => {
  it('lit les ministres auteurs du texte de dépôt, dans l’ordre, sans les autres auteurs', () => {
    const [d] = depotsSenat(dump([]), '2017-06-21');
    expect(d).toMatchObject({ signet: 'pjl25-952', typloicod: 'pjl', dateDepot: '2026-09-16', examine: false, adopteDefinitivement: false, promulgue: false });
    expect(d!.titreLong).toBe('Projet de loi relatif à la réparation des dommages');
    expect(d!.ministres.map((m) => [m.rang, m.nom])).toEqual([[1, 'NUNEZ'], [2, 'DARMANIN']]);
  });

  it('un texte de commission ou un retrait n’est pas un examen ; une adoption en séance l’est', () => {
    expect(depotsSenat(dump([{ texcod: '101', oritxtcod: '29' }, { texcod: '102', oritxtcod: '15' }]), '2017-06-21')[0]!.examine).toBe(false);
    const [examine] = depotsSenat(dump([{ texcod: '101', oritxtcod: '11' }]), '2017-06-21');
    expect([examine!.examine, examine!.adopteDefinitivement]).toEqual([true, false]);
    expect(depotsSenat(dump([{ texcod: '101', oritxtcod: '9' }]), '2017-06-21')[0]!.adopteDefinitivement).toBe(true);
  });

  it('écarte les propositions de loi et les dépôts antérieurs à la date', () => {
    expect(depotsSenat(dump([], 'ppl'), '2017-06-21')).toEqual([]);
    expect(depotsSenat(dump([], 'pjl', '2017-06-01 00:00:00'), '2017-06-21')).toEqual([]);
  });
});
