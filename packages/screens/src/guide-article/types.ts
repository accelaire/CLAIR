import type { LucideIcon } from "lucide-react";
import type { Step } from "../shared/editorial/Steps.tsx";

/** Parcours du guide pratique : étapes numérotées puis lien pour commencer. */
export type GuideArticle = {
  slug: string;
  title: string;
  icon: LucideIcon;
  /** Icône de la carte sur l'accueil du guide, si elle diffère de celle du titre. */
  cardIcon?: LucideIcon;
  /** Résumé affiché sur la page d'accueil du guide. */
  summary: string;
  intro: string;
  steps: readonly Step[];
  /** Lien « Commencer → … » de fin de parcours. */
  start: { label: string; href: string };
};
