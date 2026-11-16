/**
 * Libellé d'une thématique de scrutin. L'API les sert en minuscules, sans accents
 * (`securite`, `sante`, `education`) : on rend le mot accentué, à défaut le code avec une majuscule.
 */
const LIBELLES: Record<string, string> = {
  agriculture: "Agriculture",
  budget: "Budget",
  culture: "Culture",
  economie: "Économie",
  education: "Éducation",
  environnement: "Environnement",
  europe: "Europe",
  fiscalite: "Fiscalité",
  immigration: "Immigration",
  institutions: "Institutions",
  international: "International",
  justice: "Justice",
  sante: "Santé",
  securite: "Sécurité",
  social: "Social",
  travail: "Travail",
};

/** `securite` (ou `sécurité`) → « Sécurité » ; un code inconnu garde sa forme, avec une majuscule. */
export const libelleThematique = (code: string): string => {
  const cle = code
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  return LIBELLES[cle] ?? code.charAt(0).toUpperCase() + code.slice(1);
};
