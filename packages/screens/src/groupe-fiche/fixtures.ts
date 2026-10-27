import type {
  ApiData,
  GroupeAlliances,
  GroupeDetail,
  GroupeThematiques,
  GroupeVotes,
} from "@clair/data";

/**
 * Données FICTIVES pour les tests et les stories : groupe, membres et scrutins inventés, jamais
 * présentés comme réels.
 */
export const groupeDetailExemple: GroupeDetail = {
  id: "groupe-exemple-1",
  slug: "gex",
  chambre: "assemblee",
  legislature: 17,
  session: null,
  sessionCourante: true,
  nom: "GEX",
  nomComplet: "Groupe d'exemple",
  couleur: null,
  logoUrl: null,
  position: "centre",
  ordre: 0,
  actif: true,
  membresCount: 2,
  membresActifsCount: 2,
  rang: 1,
  totalGroupes: 3,
  totauxAmendements: 12,
  membres: [
    {
      id: "membre-1",
      slug: "camille-exemple",
      nom: "Exemple",
      prenom: "Camille",
      photoUrl: null,
      circonscription: { departement: "99", numero: 1, nom: "99 - Circonscription 1" },
      statsPresence: 40,
      statsLoyaute: 95,
    },
    {
      id: "membre-2",
      slug: "dominique-modele",
      nom: "Modèle",
      prenom: "Dominique",
      photoUrl: null,
      circonscription: null,
      statsPresence: 80,
      statsLoyaute: null,
    },
  ],
  stats: {
    presenceMoyenne: 60,
    presenceSolennelMoyenne: 90,
    loyauteMoyenne: 95,
    participationMoyenne: 60,
  },
};

export const votesExemple: ApiData<GroupeVotes> = {
  data: {
    totalVotes: 100,
    positions: { pour: 60, contre: 30, abstention: 10, absent: 0 },
    tauxParticipation: 90,
    cohesionMoyenne: 88,
    scrutinsRecents: [
      {
        id: "scrutin-1",
        numero: 42,
        titre: "l'amendement d'exemple sur les jardins partagés",
        date: "2026-03-10T00:00:00.000Z",
        sort: "adopte",
        typeVote: "ordinaire",
        session: "17",
        nombrePour: 50,
        nombreContre: 20,
        nombreAbstention: 3,
        groupeVotes: { pour: 2, contre: 0, abstention: 0, absent: 0 },
        totalGroupeVotes: 2,
        positionMajoritaire: "pour",
        cohesion: 100,
      },
    ],
  },
};

export const alliancesExemple: ApiData<GroupeAlliances> = {
  data: {
    groupeId: "groupe-exemple-1",
    groupeNom: "GEX",
    groupeCouleur: null,
    allies: [
      {
        groupe: {
          id: "groupe-exemple-2",
          slug: "gbis",
          nom: "GBIS",
          nomComplet: "Groupe bis",
          couleur: null,
          position: null,
          logoUrl: null,
        },
        tauxAccord: 80,
        votesCommuns: 8,
        votesTotaux: 10,
      },
    ],
    neutres: [],
    opposes: [],
    calculatedAt: null,
  },
};

export const thematiquesExemple: ApiData<GroupeThematiques> = {
  data: {
    groupeId: "groupe-exemple-1",
    groupeNom: "GEX",
    groupeCouleur: null,
    thematiques: [
      {
        thematique: "culture",
        position: 50,
        cohesion: 92,
        votesTotaux: 12,
        votesPour: 8,
        votesContre: 3,
        votesAbstention: 1,
      },
    ],
    calculatedAt: null,
  },
};
