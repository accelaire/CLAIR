import { describe, it, expect } from 'vitest';
import {
  choisirParentSenat, cleAmendementSenat, metadonneesAmeli,
  type AmendementSenat, type MetadonneesSenatAmeli,
} from './metadonnees-amendements-senat';
import { indexerMetadonneesAmeli, lireMetadonneesAmd } from '../sources/senat/amendements-client';

const texteMapping = new Map([[107074, { num: '138', session: '2025-2026' }]]);

// Lignes COPY de `amd` réduites aux colonnes lues (id, amdperid, txtid,
// ideid, discomid, num, alinea), le reste à \N.
const ligne = (v: { id: number; per?: number; txt: number; ide?: string; discom?: string; num: string; alinea?: string }) => {
  const f = Array<string>(36).fill('\\N');
  f[0] = String(v.id); f[2] = v.per ? String(v.per) : '\\N'; f[10] = String(v.txt);
  f[13] = v.ide ?? '\\N'; f[14] = v.discom ?? '\\N'; f[15] = v.num; f[29] = v.alinea ?? '\\N';
  return f;
};

const brutes = new Map([
  [500, { txtid: 107074, numero: '12', ...lireMetadonneesAmd(ligne({ id: 500, txt: 107074, discom: '619', num: '12', alinea: '4' })) }],
  // Sous-amendement n° 245 à l'amendement n° 12 (id AMELI 500).
  [501, { txtid: 107074, numero: '245', ...lireMetadonneesAmd(ligne({ id: 501, per: 500, txt: 107074, ide: '141', num: '245' })) }],
]);

const ameli: MetadonneesSenatAmeli = { texteMapping, ...indexerMetadonneesAmeli(brutes, texteMapping) };

const a = (id: string, uid: string, numero: string, texteRef: string | null = 'SENAT-TXT-107074'): AmendementSenat =>
  ({ id, uid, numero, texteRef });

describe('métadonnées AMELI des amendements du Sénat', () => {
  it('lit discussion, alinéa et identique depuis une ligne COPY', () => {
    expect(lireMetadonneesAmd(ligne({ id: 1, per: 7, txt: 2, ide: '141', discom: '619', num: '3', alinea: '9' })))
      .toEqual({ idDiscussionCommune: '619', idDiscussionIdentique: '141', alineaNumero: 9, parentId: 7 });
  });

  it('retrouve une row du CSV par sa clé, numéro rectifié compris', () => {
    expect(cleAmendementSenat({ numero: '12 rect. bis', texteRef: 'SENAT-TXT-107074' }, texteMapping)).toBe('2025-2026/138:12');
    expect(metadonneesAmeli(a('x', 'SENAT-AMD-S2025-2026-138-12_rect._bis', '12 rect. bis'), ameli))
      .toMatchObject({ idDiscussionCommune: '619', alineaNumero: 4, parent: null });
  });

  it('retrouve une row AMELI par son id, et donne au parent la clé de son texte', () => {
    expect(metadonneesAmeli(a('y', 'SENAT-AMD-501', '245'), ameli))
      .toEqual({ idDiscussionCommune: null, idDiscussionIdentique: '141', alineaNumero: null,
        parent: { amdId: 500, cle: '2025-2026/138:12' } });
  });

  it('rend null pour un amendement qu’AMELI ne connaît pas', () => {
    expect(metadonneesAmeli(a('z', 'SENAT-AMD-999', '1'), ameli)).toBeNull();
    expect(metadonneesAmeli(a('z', 'SENAT-AMD-S2025-2026-138-77', '77'), ameli)).toBeNull();
  });
});

describe('choisirParentSenat', () => {
  const parent = { amdId: 500, cle: '2025-2026/138:12' };

  it('prend la row AMELI du parent quand elle existe seule', () => {
    const p = a('p', 'SENAT-AMD-500', '12');
    expect(choisirParentSenat(a('e', 'SENAT-AMD-501', '245'), parent,
      { parUid: new Map([[p.uid, p]]), parCle: new Map([[parent.cle, [p]]]) })).toBe('p');
  });

  it('départage les doublons AMELI/CSV par le schéma d’uid de l’enfant', () => {
    const pAmeli = a('pa', 'SENAT-AMD-500', '12');
    const pCsv = a('pc', 'SENAT-AMD-S2025-2026-138-12', '12');
    const index = { parUid: new Map([[pAmeli.uid, pAmeli], [pCsv.uid, pCsv]]), parCle: new Map([[parent.cle, [pAmeli, pCsv]]]) };
    expect(choisirParentSenat(a('e', 'SENAT-AMD-S2025-2026-138-245', '245'), parent, index)).toBe('pc');
    expect(choisirParentSenat(a('e', 'SENAT-AMD-501', '245'), parent, index)).toBe('pa');
  });

  it('préfère le parent du même texte', () => {
    const autreTexte = a('p1', 'SENAT-AMD-S2025-2026-138-12', '12', 'SENAT-TXT-107001');
    const memeTexte = a('p2', 'SENAT-AMD-S2025-2026-138-12b', '12');
    expect(choisirParentSenat(a('e', 'SENAT-AMD-S2025-2026-138-245', '245'), parent,
      { parUid: new Map(), parCle: new Map([[parent.cle, [autreTexte, memeTexte]]]) })).toBe('p2');
  });

  it('ne devine pas entre deux candidats indiscernables', () => {
    const p1 = a('p1', 'SENAT-AMD-S2025-2026-138-12', '12');
    const p2 = a('p2', 'SENAT-AMD-T107074-12', '12');
    expect(choisirParentSenat(a('e', 'SENAT-AMD-S2025-2026-138-245', '245'), parent,
      { parUid: new Map(), parCle: new Map([[parent.cle, [p1, p2]]]) })).toBeNull();
  });

  it('rend null sans parent en base', () => {
    expect(choisirParentSenat(a('e', 'SENAT-AMD-501', '245'), parent, { parUid: new Map(), parCle: new Map() })).toBeNull();
  });
});
