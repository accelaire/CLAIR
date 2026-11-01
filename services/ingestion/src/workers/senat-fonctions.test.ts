import { describe, it, expect, vi } from 'vitest';

// Le module instancie un client Prisma : on le neutralise, seules les fonctions
// pures sont testées ici.
vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(() => ({})) }));

import {
  dateDump,
  dumpPlausible,
  ecartAvecAnnuaire,
  fonctionsVoulues,
  type MandatVoulu,
  type TablesSens,
} from './senat-fonctions';
import type { LigneDump } from '../sources/senat/sens-client';

const LARCHER = '86034E';
const LAVARDE = '14216L';

function tables(t: Record<string, LigneDump[]>): TablesSens {
  return new Map(Object.entries(t));
}

const senateurs = new Map([
  [LARCHER, { id: 'p-larcher', sexe: 'M' }],
  [LAVARDE, { id: 'p-lavarde', sexe: 'F' }],
]);
const commissions = new Map([['COM-FINC', { id: 'c-finc', nom: 'Commission des finances' }]]);

const BUR = [
  { burcod: 'PDTSEN', burlib: 'Président du Sénat', burlibfem: 'Présidente du Sénat' },
  { burcod: 'QUESTESEN', burlib: 'Questeur du Sénat', burlibfem: 'Questeure du Sénat' },
  { burcod: 'AUCUNSEN', burlib: null, burlibfem: null },
];

describe('dateDump', () => {
  it('lit le jour en UTC', () => {
    expect(dateDump('2026-10-01 00:00:00')?.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });
  it('rend null sans date', () => {
    expect(dateDump(null)).toBeNull();
  });
});

describe('fonctionsVoulues — bureau du Sénat', () => {
  const t = tables({
    bur: BUR,
    senbur: [
      { senburid: '2237', burcod: 'PDTSEN', senburdatdeb: '2014-10-01 00:00:00', senburdatfin: '2023-10-01 00:00:00', senmat: LARCHER },
      { senburid: '3122', burcod: 'PDTSEN', senburdatdeb: '2026-10-01 00:00:00', senburdatfin: null, senmat: LARCHER },
      { senburid: '2060', burcod: 'AUCUNSEN', senburdatdeb: '2011-10-01 00:00:00', senburdatfin: '2014-09-30 00:00:00', senmat: LARCHER },
      { senburid: '9000', burcod: 'QUESTESEN', senburdatdeb: '2023-10-04 00:00:00', senburdatfin: null, senmat: LAVARDE },
      { senburid: '9001', burcod: 'QUESTESEN', senburdatdeb: '2023-10-04 00:00:00', senburdatfin: null, senmat: '99999Z' },
    ],
  });
  const v = fonctionsVoulues(t, senateurs, commissions);

  it('écrit une ligne par période, sans « Sénateur » (AUCUNSEN)', () => {
    expect(v.map((m) => m.sourceUid)).toEqual(['SENBUR-2237', 'SENBUR-3122', 'SENBUR-9000']);
  });

  it('date les périodes et nomme la fonction', () => {
    const enCours = v.find((m) => m.sourceUid === 'SENBUR-3122')!;
    expect(enCours).toMatchObject({
      parlementaireId: 'p-larcher',
      typeOrgane: 'BUREAU',
      institution: 'Bureau du Sénat',
      qualite: 'Président du Sénat',
      dateFin: null,
      organeRef: 'SENAT-BUREAU',
    });
    expect(enCours.dateDebut.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('accorde la fonction au féminin', () => {
    expect(v.find((m) => m.sourceUid === 'SENBUR-9000')!.qualite).toBe('Questeure du Sénat');
  });

  it('ignore un matricule absent de la base', () => {
    expect(v.some((m) => m.sourceUid === 'SENBUR-9001')).toBe(false);
  });
});

describe('fonctionsVoulues — commissions', () => {
  const t = tables({
    com: [
      { typorgcod: 'COM', orgcod: 'FINC' },
      { typorgcod: 'COM', orgcod: 'CULT' },
      { typorgcod: 'COM', orgcod: 'NEANT' },
      { typorgcod: 'CMP', orgcod: '20251104N31' },
    ],
    libcom: [
      { orgcod: 'CULT', libcomdatdeb: '1899-12-31 00:00:00', libcomdatfin: '2012-01-31 00:00:00', libcomlilmin: 'commission des affaires culturelles' },
      { orgcod: 'CULT', libcomdatdeb: '2012-02-01 00:00:00', libcomdatfin: null, libcomlilmin: 'commission de la culture' },
    ],
    foncom: [
      { foncomcod: 'MEMBRECOM', foncomlib: ' ', foncomlibfem: ' ', foncomlic: 'Membre', foncomlicfem: 'Membre' },
      { foncomcod: 'RAPGENCOM', foncomlib: 'Rapporteur général', foncomlibfem: 'Rapporteure générale', foncomlic: null, foncomlicfem: null },
    ],
    memcom: [
      { memcomid: '1', orgcod: 'FINC', memcomdatdeb: '2020-10-01 00:00:00', memcomdatfin: null, senmat: LAVARDE },
      { memcomid: '2', orgcod: 'CULT', memcomdatdeb: '2008-10-01 00:00:00', memcomdatfin: '2011-09-30 00:00:00', senmat: LARCHER },
      { memcomid: '3', orgcod: 'NEANT', memcomdatdeb: '2026-10-01 00:00:00', memcomdatfin: null, senmat: LARCHER },
      { memcomid: '4', orgcod: '20251104N31', memcomdatdeb: '2025-11-04 00:00:00', memcomdatfin: null, senmat: LAVARDE },
    ],
    fonmemcom: [
      // Membre, puis rapporteure générale : deux périodes de la même appartenance.
      { fonmemcomid: '10', foncomcod: 'MEMBRECOM', fonmemcomdatdeb: '2020-10-01 00:00:00', fonmemcomdatfin: '2023-10-03 00:00:00', memcomid: '1' },
      { fonmemcomid: '11', foncomcod: 'RAPGENCOM', fonmemcomdatdeb: '2023-10-04 00:00:00', fonmemcomdatfin: null, memcomid: '1' },
      // Fonction déclarée au-delà de l'appartenance : ramenée à celle-ci.
      { fonmemcomid: '20', foncomcod: 'MEMBRECOM', fonmemcomdatdeb: '2008-09-01 00:00:00', fonmemcomdatfin: null, memcomid: '2' },
      { fonmemcomid: '30', foncomcod: 'MEMBRECOM', fonmemcomdatdeb: '2026-10-01 00:00:00', fonmemcomdatfin: null, memcomid: '3' },
      { fonmemcomid: '40', foncomcod: 'MEMBRECOM', fonmemcomdatdeb: '2025-11-04 00:00:00', fonmemcomdatfin: null, memcomid: '4' },
    ],
  });
  const v = fonctionsVoulues(t, senateurs, commissions);
  const parUid = new Map(v.map((m) => [m.sourceUid, m]));

  it('ne garde que les commissions permanentes, sans la pseudo-commission du président', () => {
    expect([...parUid.keys()].sort()).toEqual(['SENCOM-10', 'SENCOM-11', 'SENCOM-20']);
  });

  it('lie la commission connue et écrit chaque période de fonction', () => {
    expect(parUid.get('SENCOM-10')).toMatchObject({ qualite: 'Membre', commissionId: 'c-finc', organeRef: 'COM-FINC' });
    expect(parUid.get('SENCOM-11')).toMatchObject({
      qualite: 'Rapporteure générale',
      institution: 'Commission des finances',
      dateFin: null,
    });
  });

  it("borne la fonction à l'appartenance et prend le libellé de l'époque", () => {
    const m = parUid.get('SENCOM-20')!;
    expect(m.dateDebut.toISOString()).toBe('2008-10-01T00:00:00.000Z');
    expect(m.dateFin?.toISOString()).toBe('2011-09-30T00:00:00.000Z');
    expect(m.institution).toBe('Commission des affaires culturelles');
    expect(m.commissionId).toBeNull();
  });
});

describe('fonctionsVoulues — groupes politiques', () => {
  const t = tables({
    libgrppol: [
      { grppolcod: 'UMP', libgrppoldatdeb: '2002-12-11 00:00:00', libgrppoldatfin: '2015-06-01 00:00:00', evelib: 'Groupe UMP' },
      { grppolcod: 'UMP', libgrppoldatdeb: '2015-06-02 00:00:00', libgrppoldatfin: null, evelib: 'Groupe Les Républicains' },
    ],
    fongrppol: [
      { fongrppolcod: 'MEMBREPOL', fongrppollib: ' ', fongrppollibfem: ' ' },
      { fongrppolcod: 'PDTPOL', fongrppollib: 'Président', fongrppollibfem: 'Présidente' },
    ],
    memgrppol: [{ memgrppolid: '5', grppolcod: 'UMP', memgrppoldatdeb: '2007-10-01 00:00:00', memgrppoldatfin: null, senmat: LARCHER }],
    fonmemgrppol: [
      { fonmemgrppolid: '50', fongrppolcod: 'MEMBREPOL', fonmemgrppoldatdeb: '2007-10-01 00:00:00', fonmemgrppoldatfin: null, memgrppolid: '5' },
      { fonmemgrppolid: '51', fongrppolcod: 'PDTPOL', fonmemgrppoldatdeb: '2011-10-01 00:00:00', fonmemgrppoldatfin: '2014-09-30 00:00:00', memgrppolid: '5' },
    ],
  });
  const v = fonctionsVoulues(t, senateurs, commissions);

  it("n'écrit pas la simple appartenance, déjà portée par le mandat de sénateur", () => {
    expect(v.map((m) => m.sourceUid)).toEqual(['SENGRP-51']);
  });

  it("nomme le groupe tel qu'il s'appelait alors", () => {
    expect(v[0]).toMatchObject({ typeOrgane: 'GP', qualite: 'Président', institution: 'Groupe UMP', organeRef: 'GRP-UMP' });
  });
});

describe('dumpPlausible', () => {
  const ligne = (typeOrgane: string, dateFin: Date | null): MandatVoulu => ({
    sourceUid: 'x', parlementaireId: 'p', typeOrgane, institution: '', qualite: '',
    dateDebut: new Date(0), dateFin, organeRef: '', commissionId: null,
  });

  it('refuse un dump sans bureau ni commissions en cours', () => {
    expect(dumpPlausible([ligne('BUREAU', null)]).ok).toBe(false);
  });

  it('accepte un dump complet', () => {
    const v = [
      ...Array.from({ length: 26 }, () => ligne('BUREAU', null)),
      ...Array.from({ length: 389 }, () => ligne('COMMISSION', null)),
    ];
    expect(dumpPlausible(v)).toEqual({ ok: true, bureau: 26, commissions: 389 });
  });
});

describe('ecartAvecAnnuaire', () => {
  it('compte les appartenances présentes d’un seul côté', () => {
    const dump = [
      { parlementaireId: 'a', organeRef: 'COM-FINC' },
      { parlementaireId: 'b', organeRef: 'COM-LOIS' },
    ];
    const annuaire = [
      { parlementaireId: 'a', organeRef: 'COM-FINC' },
      { parlementaireId: 'b', organeRef: 'COM-SOCI' },
    ];
    expect(ecartAvecAnnuaire(dump, annuaire)).toBe(2);
    expect(ecartAvecAnnuaire(dump, dump)).toBe(0);
  });
});
