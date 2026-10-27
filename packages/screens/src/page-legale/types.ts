import type { Block } from "../shared/rich-text/rich-text.ts";

export type LegalSection = {
  /** Ancre de la section, reprise par le sommaire. */
  id: string;
  title: string;
  blocks: readonly Block[];
};

/** Contenu d'une page légale : titre, date de mise à jour et sections titrées. */
export type LegalPage = {
  title: string;
  /** Mois de la dernière mise à jour, tel qu'affiché (« janvier 2026 »). */
  updatedAt: string;
  sections: readonly LegalSection[];
};
