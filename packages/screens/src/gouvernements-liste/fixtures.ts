import type { GouvernementsReponse, PersonneGouvernement } from "@clair/data";

/**
 * Données FICTIVES pour les tests et les stories : personnes, noms de gouvernements et comptes
 * inventés. Elles ne décrivent aucun gouvernement réel.
 */

export const personneFictive = (
  acteurUid: string,
  prenom: string,
  nom: string,
  civilite: "M." | "Mme" = "M.",
  slug: string | null = null,
): PersonneGouvernement => ({
  acteurUid,
  civilite,
  prenom,
  nom,
  parlementaire: slug ? { slug, chambre: "assemblee", photoUrl: null } : null,
});

const presidenceA = { uid: "PO-PRES-A", civilite: "Mme", prenom: "Ariane", nom: "Exemple" };
const presidenceB = { uid: "PO-PRES-B", civilite: "M.", prenom: "Bruno", nom: "Modèle" };

export const gouvernementsFixture: GouvernementsReponse = {
  data: [
    {
      uid: "PO-G3",
      slug: "fictif-ii",
      nom: "Fictif II",
      numero: 2,
      dateDebut: "2025-09-10",
      dateFin: null,
      enCours: true,
      premierMinistre: personneFictive("PA1", "Camille", "Fictif", "M.", "camille-fictif"),
      presidence: presidenceA,
      nbPostes: 36,
      nbMembres: 34,
      nbFemmes: 17,
      couverture: "depuis_2017",
      bilan: { engagements: 2, motions: 3 },
    },
    {
      uid: "PO-G2",
      slug: "fictif-i",
      nom: "Fictif I",
      numero: 1,
      dateDebut: "2024-01-09",
      dateFin: "2025-09-09",
      enCours: false,
      premierMinistre: personneFictive("PA1", "Camille", "Fictif", "M.", "camille-fictif"),
      presidence: presidenceA,
      nbPostes: 40,
      nbMembres: 35,
      nbFemmes: 16,
      couverture: "depuis_2017",
      bilan: { engagements: 0, motions: 1 },
    },
    {
      uid: "PO-G1",
      slug: "imaginaire",
      nom: "Imaginaire",
      numero: 1,
      dateDebut: "2010-05-17",
      dateFin: "2012-05-10",
      enCours: false,
      premierMinistre: personneFictive("PA9", "Dominique", "Imaginaire", "Mme"),
      presidence: presidenceB,
      nbPostes: 30,
      nbMembres: 28,
      nbFemmes: 9,
      couverture: "avant_2017",
      bilan: null,
    },
  ],
  source: {
    nom: "open data de l’Assemblée nationale (fixture)",
    url: "https://example.org/source",
  },
};
