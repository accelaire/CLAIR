import type { ContexteGouvernemental, MotionDuScrutin, PersonneGouvernement } from "@clair/data";

/**
 * Contexte gouvernemental d'exemple (fiches dossier et sujet, scrutin d'une motion). Personnes,
 * gouvernement, textes et chiffres FICTIFS.
 */

const personne = (prenom: string, nom: string, slug: string | null): PersonneGouvernement => ({
  acteurUid: `PA-${nom}`,
  civilite: "Mme",
  prenom,
  nom,
  parlementaire: slug ? { slug, chambre: "assemblee", photoUrl: null } : null,
});

const gouvernementExemple = { slug: "exemple", nom: "Exemple" };

const motionRejetee = {
  date: "2026-02-03",
  alinea: 3,
  premierSignataire: "M. Dominique Modèle",
  pour: 120,
  majoriteRequise: 289,
  adoptee: false,
  scrutin: { numero: 42, chambre: "assemblee", session: "17" },
  engagementDossierUid: "DLENGAGEMENT1",
};

export const contexteGouvernementalExemple: ContexteGouvernemental = {
  projets: [
    {
      dossier: { uid: "DLEXEMPLE1", titre: "Projet de loi d'exemple" },
      nature: "ordinaire",
      stade: "adopte",
      chambreDepot: "assemblee",
      dateDepot: "2026-01-05",
      loi: null,
      gouvernement: gouvernementExemple,
      signataires: [
        {
          role: "premier_ministre",
          qualite: "Première ministre",
          intitule: "Premier ministre",
          intituleCourt: null,
          membre: { ...personne("Camille", "Exemple", "camille-exemple"), slug: "camille-exemple" },
        },
        {
          role: "chef_de_file",
          qualite: "Ministre",
          intitule: "Ministère de l'exemple",
          intituleCourt: "Exemple",
          membre: { ...personne("Alex", "Fictif", null), slug: "alex-fictif" },
        },
      ],
    },
  ],
  engagements: [
    {
      date: "2026-02-01",
      dossier: {
        uid: "DLENGAGEMENT1",
        titre: "Engagement de la responsabilité du Gouvernement sur le projet de loi d'exemple",
      },
      texte: { uid: "DLEXEMPLE1", titre: "Projet de loi d'exemple" },
      gouvernement: gouvernementExemple,
      premierMinistre: {
        ...personne("Camille", "Exemple", "camille-exemple"),
        slug: "camille-exemple",
      },
      motions: [motionRejetee],
    },
  ],
};

export const motionAdopteeExemple: MotionDuScrutin = {
  ...motionRejetee,
  pour: 300,
  adoptee: true,
  gouvernement: gouvernementExemple,
  engagement: {
    date: "2026-02-01",
    dossierUid: "DLENGAGEMENT1",
    texte: { uid: "DLEXEMPLE1", titre: "Projet de loi d'exemple" },
  },
};
