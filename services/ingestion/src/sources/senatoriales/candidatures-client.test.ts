import { describe, it, expect } from 'vitest';
import { planifierEcritures } from './candidatures-client.js';

const liste = (o: { id: string; sourceUid: string; libelle?: string | null }) => ({
  scrutin: 'senatoriales-2026',
  circonscriptionId: 'circo-75',
  modeScrutin: 'proportionnel',
  numeroDepot: 1,
  libelle: o.libelle ?? 'Liste A',
  nuance: 'LDVD',
  nuanceLibelle: null,
  famille: 'droite',
  ...o,
});

const candidat = (o: { id: string; listeId: string; ordre: number; nom?: string }) => ({
  role: 'titulaire',
  nom: o.nom ?? 'DUPONT',
  prenom: 'Marie',
  sexe: 'F',
  anneeNaissance: 1970,
  dateNaissance: new Date('1970-01-01T00:00:00Z'),
  professionCode: null,
  professionLabel: null,
  sortantDeclare: false,
  personneId: null,
  matchConfiance: null,
  ...o,
});

describe('planifierEcritures', () => {
  it("ne réécrit rien quand le fichier n'a pas changé, malgré les identifiants tirés à neuf", () => {
    const plan = planifierEcritures(
      [liste({ id: 'L-base', sourceUid: 'u1' })],
      [candidat({ id: 'C-base', listeId: 'L-base', ordre: 1 })],
      [liste({ id: 'L-neuf', sourceUid: 'u1' })],
      [candidat({ id: 'C-neuf', listeId: 'L-neuf', ordre: 1 })],
    );
    expect(plan.listes.aCreer).toEqual([]);
    expect(plan.listes.aSupprimer).toEqual([]);
    expect(plan.listes.inchanges).toBe(1);
    expect(plan.candidatures.aCreer).toEqual([]);
    expect(plan.candidatures.aSupprimer).toEqual([]);
    expect(plan.candidatures.inchanges).toBe(1);
  });

  it("rattache une candidature nouvelle à l'identifiant de la liste déjà connue", () => {
    const plan = planifierEcritures(
      [liste({ id: 'L-base', sourceUid: 'u1' })],
      [candidat({ id: 'C-base', listeId: 'L-base', ordre: 1 })],
      [liste({ id: 'L-neuf', sourceUid: 'u1' })],
      [candidat({ id: 'C1', listeId: 'L-neuf', ordre: 1 }), candidat({ id: 'C2', listeId: 'L-neuf', ordre: 2 })],
    );
    expect(plan.candidatures.aCreer).toHaveLength(1);
    expect(plan.candidatures.aCreer[0]).toMatchObject({ id: 'C2', listeId: 'L-base', ordre: 2 });
  });

  it("modifie en place une candidature corrigée, sans changer d'identifiant", () => {
    const plan = planifierEcritures(
      [liste({ id: 'L-base', sourceUid: 'u1' })],
      [candidat({ id: 'C-base', listeId: 'L-base', ordre: 1, nom: 'DUPOND' })],
      [liste({ id: 'L-neuf', sourceUid: 'u1' })],
      [candidat({ id: 'C-neuf', listeId: 'L-neuf', ordre: 1, nom: 'DUPONT' })],
    );
    expect(plan.candidatures.aModifier).toHaveLength(1);
    expect(plan.candidatures.aModifier[0]!.existant.id).toBe('C-base');
  });

  it('supprime une liste retirée et crée une liste apparue', () => {
    const plan = planifierEcritures(
      [liste({ id: 'L-retiree', sourceUid: 'u1' })],
      [candidat({ id: 'C-retiree', listeId: 'L-retiree', ordre: 1 })],
      [liste({ id: 'L-neuve', sourceUid: 'u2' })],
      [candidat({ id: 'C-neuve', listeId: 'L-neuve', ordre: 1 })],
    );
    expect(plan.listes.aSupprimer.map((l) => l.id)).toEqual(['L-retiree']);
    expect(plan.listes.aCreer.map((l) => l.id)).toEqual(['L-neuve']);
    expect(plan.candidatures.aCreer[0]).toMatchObject({ id: 'C-neuve', listeId: 'L-neuve' });
    expect(plan.candidatures.aSupprimer.map((c) => c.id)).toEqual(['C-retiree']);
  });
});
