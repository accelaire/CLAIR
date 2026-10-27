import type { FaqItem } from "./Faq.tsx";

/** Questions d'exemple, sans donnée parlementaire réelle. */
export const questionsExemple: FaqItem[] = [
  {
    question: "D'où viennent les données ?",
    answer:
      "Des données ouvertes publiées par l'Assemblée nationale et le Sénat, synchronisées chaque jour.",
  },
  {
    question: "Les résumés sont-ils officiels ?",
    answer:
      "Non. Les résumés sont produits par une intelligence artificielle et signalés comme tels ; le texte officiel reste la référence.",
  },
  {
    question: "Comment signaler une erreur ?",
    answer: "Par le formulaire de contact : chaque signalement est relu par l'équipe.",
  },
];
