import { describe, it, expect } from 'vitest';
import { lignesLobbyistesRetenues } from './sync';

const ligne = (id: string, identifiantNational: string | null) => ({ id, identifiantNational });

describe('lignesLobbyistesRetenues', () => {
  it("retient la ligne au plus grand identifiant HATVP, quel que soit l'ordre", () => {
    const a = ligne('9', '823117510');
    const b = ligne('10', '823117510');
    for (const lignes of [[a, b], [b, a]]) {
      const { retenues, doublons } = lignesLobbyistesRetenues(lignes);
      expect(retenues).toEqual([b]);
      expect([...doublons]).toEqual([a]);
    }
  });

  it("garde toutes les lignes sans identifiant national, et celles qui n'ont pas de double", () => {
    const sans = ligne('1', null);
    const vide = ligne('2', '  ');
    const seule = ligne('3', '123456789');
    const { retenues, doublons } = lignesLobbyistesRetenues([sans, vide, seule]);
    expect(retenues).toEqual([sans, vide, seule]);
    expect(doublons.size).toBe(0);
  });
});
