import type { ApiData, GroupePolitique } from "@clair/data";

/**
 * Groupes FICTIFS pour les tests et les stories : noms, sigles et effectifs inventés, jamais
 * présentés comme réels.
 */
const base: GroupePolitique = {
  id: "groupe-exemple-1",
  slug: "gex",
  chambre: "assemblee",
  nom: "GEX",
  nomComplet: "Groupe d'exemple",
  couleur: null,
  position: "centre",
  nomCourt: null,
  logoUrl: null,
  ordre: 0,
  actif: true,
  legislature: 17,
  membresCount: 40,
  statsMembresActifs: 40,
  statsPresenceMoyenne: 50,
  statsLoyauteMoyenne: 90,
  statsCohesion: 85,
  statsParticipation: 1000,
  statsCalculatedAt: null,
};

export const groupeExemple = base;

export const groupeExempleBis: GroupePolitique = {
  ...base,
  id: "groupe-exemple-2",
  slug: "gbis",
  nom: "GBIS",
  nomComplet: "Groupe bis des jardiniers",
  position: "gauche",
  membresCount: 25,
};

export const groupeExempleSenat: GroupePolitique = {
  ...base,
  id: "groupe-exemple-3",
  slug: "gsen",
  chambre: "senat",
  nom: "GSEN",
  nomComplet: "Groupe sénatorial d'exemple",
  legislature: null,
  membresCount: 30,
};

export const groupesExemple = (
  groupes: GroupePolitique[] = [groupeExemple, groupeExempleBis, groupeExempleSenat],
): ApiData<GroupePolitique[]> => ({ data: groupes });

export const legislaturesExemple = {
  data: [
    { legislature: 17, count: 500 },
    { legislature: 16, count: 500 },
  ],
};

export const sessionsExemple = {
  data: [
    {
      chambre: "senat",
      legislature: null,
      session: "2025",
      dateDebut: "2025-10-01",
      dateFin: "2026-07-01",
      count: 10,
    },
  ],
};
