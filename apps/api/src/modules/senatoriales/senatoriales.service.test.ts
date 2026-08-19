import { describe, it, expect } from 'vitest';
import { joursCouverts, comparateur, type Sortant } from './senatoriales.service';

function sortant(partiel: {
  nom?: string;
  prenom?: string;
  mandatId?: string;
  departement?: string | null;
  presence?: number | null;
  loyaute?: number | null;
  amendements?: number | null;
  interventions?: number | null;
  groupeSlug?: string | null;
  groupeNom?: string;
  commission?: string | null;
  profession?: string | null;
  dateNaissance?: string | null;
} = {}): Sortant {
  return {
    mandatId: partiel.mandatId ?? 'mandat-defaut',
    personne: {
      id: 'personne-defaut',
      slug: 'jean-dupont',
      nom: partiel.nom ?? 'Dupont',
      prenom: partiel.prenom ?? 'Jean',
      photoUrl: null,
      profession:
        partiel.profession === undefined ? 'Profession par défaut' : partiel.profession,
      dateNaissance:
        partiel.dateNaissance === undefined ? '1975-05-20' : partiel.dateNaissance,
      sexe: 'M',
    },
    groupe:
      partiel.groupeSlug === null
        ? null
        : {
            slug: partiel.groupeSlug ?? 'groupe-defaut',
            nom: partiel.groupeNom ?? 'Groupe par défaut',
            nomComplet: 'Groupe par défaut au complet',
            couleur: '#CCCCCC',
            position: 'gauche',
          },
    circonscription:
      partiel.departement === null
        ? null
        : {
            departement: partiel.departement ?? '01',
            nom: 'Ain',
          },
    commissionPermanente:
      partiel.commission === undefined ? 'Affaires étrangères' : partiel.commission,
    mandat: {
      dateDebut: '2020-10-01T00:00:00.000Z',
      dateFin: null,
      mandatComplet: true,
      dureeMois: 72,
      segments: 1,
      interrompu: false,
    },
    bilan: {
      presence: partiel.presence ?? null,
      loyaute: partiel.loyaute ?? null,
      participation: null,
      interventions: partiel.interventions ?? null,
      amendements: partiel.amendements ?? null,
      calculatedAt: null,
    },
  };
}

describe('joursCouverts', () => {
  it('compte la durée exacte d\'un segment clos (30 jours du 1er au 31 octobre)', () => {
    const debut = new Date('2020-10-01T00:00:00.000Z');
    const fin = new Date('2020-10-31T00:00:00.000Z');
    expect(joursCouverts(debut, fin)).toBe(30);
  });

  it('borne un segment ouvert au jour du scrutin, pas à aujourd\'hui (26 jours depuis le 1er septembre 2026)', () => {
    const debut = new Date('2026-09-01T00:00:00.000Z');
    expect(joursCouverts(debut, null)).toBe(26);
  });

  it('borne un segment se terminant après le scrutin au jour du scrutin', () => {
    const debut = new Date('2026-09-20T00:00:00.000Z');
    const fin = new Date('2026-12-31T00:00:00.000Z');
    expect(joursCouverts(debut, fin)).toBe(7);
  });

  it('renvoie zéro pour un segment commencé après le scrutin et jamais un nombre négatif', () => {
    const debut = new Date('2026-09-28T00:00:00.000Z');
    expect(joursCouverts(debut, null)).toBe(0);
  });
});

describe('comparateur', () => {
  describe('tri par nom', () => {
    it('ordonne alphabétiquement par nom puis prénom', () => {
      const a = sortant({ nom: 'Dupont', prenom: 'Jean' });
      const b = sortant({ nom: 'Martin', prenom: 'Pierre' });
      const c = sortant({ nom: 'Dupont', prenom: 'Pierre' });

      expect(comparateur('nom')(a, b)).toBeLessThan(0);
      expect(comparateur('nom')(a, c)).toBeLessThan(0);
    });
  });

  describe('tri par département', () => {
    it('ordonne les codes INSEE lexicographiquement (01 avant 10 avant 2A)', () => {
      const a = sortant({ departement: '01' });
      const b = sortant({ departement: '10' });
      const c = sortant({ departement: '2A' });

      expect(comparateur('departement')(a, b)).toBeLessThan(0);
      expect(comparateur('departement')(b, c)).toBeLessThan(0);
    });

    it('place les sortants sans circonscription en dernier', () => {
      const avec = sortant({ departement: '2A' });
      const sans = sortant({ departement: null });

      expect(comparateur('departement')(avec, sans)).toBeLessThan(0);
      expect(comparateur('departement')(sans, avec)).toBeGreaterThan(0);
    });
  });

  describe('tri par groupe', () => {
    it('range les groupes par ordre alphabétique de libellé', () => {
      const socialiste = sortant({ groupeSlug: 'ser', groupeNom: 'SER' });
      const republicain = sortant({ groupeSlug: 'lr', groupeNom: 'Les Républicains' });
      expect(comparateur('groupe')(republicain, socialiste)).toBeLessThan(0);
      expect(comparateur('groupe')(socialiste, republicain)).toBeGreaterThan(0);
    });

    it('garde les membres d’un même groupe contigus, ordonnés par identité', () => {
      const dupont = sortant({ groupeSlug: 'lr', groupeNom: 'Les Républicains', nom: 'Dupont' });
      const bernard = sortant({ groupeSlug: 'lr', groupeNom: 'Les Républicains', nom: 'Bernard' });
      expect(comparateur('groupe')(bernard, dupont)).toBeLessThan(0);
    });

    it('rejette les mandats sans groupe en fin de liste', () => {
      // Un mandat non rattaché n'est pas un groupe politique : il ne doit pas
      // s'intercaler alphabétiquement au milieu de groupes réels.
      const avec = sortant({ groupeSlug: 'zzz-tres-loin', groupeNom: 'Zèbres' });
      const sans = sortant({ groupeSlug: null });
      expect(comparateur('groupe')(avec, sans)).toBeLessThan(0);
      expect(comparateur('groupe')(sans, avec)).toBeGreaterThan(0);
    });

    it('est un ordre total : deux sortants ne sont jamais à égalité', () => {
      // Sans départage, une liste triée peut changer d'ordre d'un appel à
      // l'autre et faire sauter des lignes d'une page à la suivante.
      const a = sortant({ groupeSlug: 'lr', groupeNom: 'Les Républicains', nom: 'Martin', prenom: 'Anne', mandatId: 'm1' });
      const b = sortant({ groupeSlug: 'lr', groupeNom: 'Les Républicains', nom: 'Martin', prenom: 'Anne', mandatId: 'm2' });
      expect(comparateur('groupe')(a, b)).not.toBe(0);
      expect(comparateur('groupe')(a, b)).toBe(-comparateur('groupe')(b, a));
    });
  });

  describe('tri par commission', () => {
    it('rassemble les membres d’une même commission, commissions par ordre alphabétique', () => {
      const finances = sortant({ commission: 'Commission des finances' });
      const lois = sortant({ commission: 'Commission des lois' });
      expect(comparateur('commission')(finances, lois)).toBeLessThan(0);
    });

    it('place les sortants sans commission en dernier', () => {
      const avec = sortant({ commission: 'Zèbres' });
      const sans = sortant({ commission: null });
      expect(comparateur('commission')(avec, sans)).toBeLessThan(0);
      expect(comparateur('commission')(sans, avec)).toBeGreaterThan(0);
    });
  });

  describe('tri par profession', () => {
    it('regroupe sur la famille, pas sur la catégorie détaillée', () => {
      // « Salariés (Cadres divers) » et « Salariés (Retraités) » sont la même
      // famille : ils doivent rester contigus, donc être départagés à l'identité.
      const cadre = sortant({ profession: 'Salariés (Cadres divers)', nom: 'Bernard' });
      const retraite = sortant({ profession: 'Salariés (Retraités)', nom: 'Zola' });
      const fonctionnaire = sortant({ profession: 'Fonctionnaires (Divers)', nom: 'Aaron' });

      expect(comparateur('profession')(cadre, retraite)).toBeLessThan(0);
      // Fonctionnaires précède Salariés, quel que soit le nom.
      expect(comparateur('profession')(fonctionnaire, cadre)).toBeLessThan(0);
    });

    it('place les sortants sans profession déclarée en dernier', () => {
      const avec = sortant({ profession: 'Zèbres' });
      const sans = sortant({ profession: null });
      expect(comparateur('profession')(avec, sans)).toBeLessThan(0);
      expect(comparateur('profession')(sans, avec)).toBeGreaterThan(0);
    });
  });

  describe('tri par âge', () => {
    it('ordonne du plus âgé au plus jeune', () => {
      const doyen = sortant({ dateNaissance: '1943-02-11' });
      const benjamin = sortant({ dateNaissance: '1991-09-27' });
      expect(comparateur('age')(doyen, benjamin)).toBeLessThan(0);
      expect(comparateur('age')(benjamin, doyen)).toBeGreaterThan(0);
    });

    it('place les dates de naissance inconnues en dernier, sans les traiter comme une jeunesse', () => {
      const connu = sortant({ dateNaissance: '1991-09-27' });
      const inconnu = sortant({ dateNaissance: null });
      expect(comparateur('age')(connu, inconnu)).toBeLessThan(0);
      expect(comparateur('age')(inconnu, connu)).toBeGreaterThan(0);
    });
  });

  describe('tri par présence', () => {
    it('ordonne par présence décroissante', () => {
      const a = sortant({ presence: 98 });
      const b = sortant({ presence: 46 });

      expect(comparateur('presence')(a, b)).toBeLessThan(0);
      expect(comparateur('presence')(b, a)).toBeGreaterThan(0);
    });

    it('place les valeurs nulles en dernier, sans les traiter comme un zéro', () => {
      const zero = sortant({ presence: 0 });
      const nul = sortant({ presence: null });
      const positif = sortant({ presence: 10 });

      expect(comparateur('presence')(zero, nul)).toBeLessThan(0);
      expect(comparateur('presence')(nul, zero)).toBeGreaterThan(0);
      expect(comparateur('presence')(nul, positif)).toBeGreaterThan(0);
      expect(comparateur('presence')(positif, nul)).toBeLessThan(0);
    });

    it('produit un ordre total stable en cas d\'égalité de statistique (anti-pagination-instable)', () => {
      const s1 = sortant({ nom: 'Dupont', prenom: 'Jean', mandatId: 'm1', presence: 50 });
      const s2 = sortant({ nom: 'Dupont', prenom: 'Jean', mandatId: 'm2', presence: 50 });
      const s3 = sortant({ nom: 'Martin', prenom: 'Pierre', mandatId: 'm3', presence: 50 });
      const s4 = sortant({ nom: 'Martin', prenom: 'Anna', mandatId: 'm4', presence: 50 });

      const shuffleA = [s3, s1, s4, s2];
      const shuffleB = [s4, s2, s3, s1];
      const cmp = comparateur('presence');

      const sortedA = [...shuffleA].sort(cmp);
      const sortedB = [...shuffleB].sort(cmp);

      const ordreAttendu = ['m1', 'm2', 'm4', 'm3'];
      expect(sortedA.map((s) => s.mandatId)).toEqual(ordreAttendu);
      expect(sortedB.map((s) => s.mandatId)).toEqual(ordreAttendu);
    });
  });
});