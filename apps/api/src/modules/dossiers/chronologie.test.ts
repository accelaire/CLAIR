import { describe, it, expect } from 'vitest';
import { fusionnerLesJourneesSansReference, type EtapeDeChronologie } from './chronologie';

// Une journée de la 15e législature : deux comptes rendus sans référence de
// séance (le matin et l'après-midi), et les votes du jour, que les scrutins
// rangent sous une référence de séance qu'aucun compte rendu ne porte.

function etape(uid: string, date: string, nbPrises: number | null, scrutins: string[] = []): EtapeDeChronologie {
  return {
    uid,
    textes: [],
    type: 'seance',
    date: new Date(date),
    chambre: 'assemblee',
    commission: null,
    nbPrises,
    nbAvis: null,
    consultable: nbPrises !== null,
    scrutins: scrutins.map((id, i) => ({
      id,
      numero: i + 1,
      titre: id,
      date: new Date(date.slice(0, 10)),
      sort: 'adopte',
      chambre: 'assemblee',
      session: '15',
      nombrePour: 1,
      nombreContre: 0,
      nombreAbstention: 0,
    })),
  };
}

describe('fusionnerLesJourneesSansReference', () => {
  it('rattache les votes sans débat au compte rendu du jour', () => {
    const votes = etape('RUANR5L15S2018IDS20500', '2018-05-29T00:00:00Z', null, ['s1', 's2']);
    const debat = etape('CRSANR5L15S2018O1N100', '2018-05-29T15:00:00Z', 120);

    const resultat = fusionnerLesJourneesSansReference([votes, debat], new Set([debat.uid]));

    expect(resultat.map((e) => e.uid)).toEqual([debat.uid]);
    expect(resultat[0]!.scrutins.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(resultat[0]!.nbPrises).toBe(120);
  });

  it('garde une entrée par compte rendu quand la journée en compte deux', () => {
    const votes = etape('RUANR5L15S2018IDS20500', '2018-05-29T00:00:00Z', null, ['s1']);
    const matin = etape('CRSANR5L15S2018O1N100', '2018-05-29T09:30:00Z', 40);
    const apresMidi = etape('CRSANR5L15S2018O1N101', '2018-05-29T15:00:00Z', 90);

    const resultat = fusionnerLesJourneesSansReference(
      [votes, matin, apresMidi],
      new Set([matin.uid, apresMidi.uid]),
    );

    expect(resultat.map((e) => e.uid)).toEqual([matin.uid, apresMidi.uid]);
    expect(resultat.map((e) => e.nbPrises)).toEqual([40, 90]);
    // La source ne dit pas à quelle séance appartient le vote : il va au plus
    // long débat, et n'est compté qu'une fois.
    expect(resultat[0]!.scrutins).toEqual([]);
    expect(resultat[1]!.scrutins.map((s) => s.id)).toEqual(['s1']);
  });

  it('ne touche pas à une séance qui porte ses propres prises de parole', () => {
    const referencee = etape('RUANR5L15S2018IDS20501', '2018-05-29T21:30:00Z', 30, ['s3']);
    const sansRef = etape('CRSANR5L15S2018O1N100', '2018-05-29T15:00:00Z', 90);

    const resultat = fusionnerLesJourneesSansReference([sansRef, referencee], new Set([sansRef.uid]));

    expect(resultat.map((e) => e.uid)).toEqual([sansRef.uid, referencee.uid]);
    expect(resultat[1]!.scrutins.map((s) => s.id)).toEqual(['s3']);
  });

  it("ne mêle pas l'Assemblée et le Sénat d'un même jour", () => {
    const debat = etape('CRSANR5L15S2018O1N100', '2018-05-29T15:00:00Z', 90);
    const senat = { ...etape('d20180529', '2018-05-29T00:00:00Z', null, ['s4']), chambre: 'senat' };

    const resultat = fusionnerLesJourneesSansReference([senat, debat], new Set([debat.uid]));

    expect(resultat.map((e) => e.uid)).toEqual([senat.uid, debat.uid]);
  });

  it('laisse les autres journées intactes', () => {
    const autre = etape('RUANR5L15S2018IDS20600', '2018-06-05T00:00:00Z', null, ['s5']);
    const debat = etape('CRSANR5L15S2018O1N100', '2018-05-29T15:00:00Z', 90);

    const resultat = fusionnerLesJourneesSansReference([debat, autre], new Set([debat.uid]));

    expect(resultat).toHaveLength(2);
  });
});
