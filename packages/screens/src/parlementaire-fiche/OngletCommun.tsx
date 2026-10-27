"use client";

import { DateRangePicker } from "@clair/ui";
import type { ParlementaireFicheFiltres } from "./params.ts";

/** Ce que chaque onglet paginé reçoit de l'écran. */
export type OngletProps = {
  /** Chemin de l'API et des pages (`/deputes`, `/senateurs`). */
  chemin: string;
  slug: string;
  filtres: ParlementaireFicheFiltres;
  /** Change les filtres de l'onglet (retour à la première page, URL mise à jour). */
  changer: (changement: Partial<ParlementaireFicheFiltres>) => void;
  pageHref: (page: number) => string;
  /** Début du premier mandat (AAAA-MM-JJ) : borne du calendrier. */
  dateMin?: string;
};

/** Filtre de période (`dateFrom`, `dateTo` dans l'URL). */
export const PeriodeFiltre = ({
  filtres,
  changer,
  dateMin,
}: Pick<OngletProps, "filtres" | "changer" | "dateMin">) => (
  <DateRangePicker
    label="Période"
    placeholder="Toute la période"
    value={{ from: filtres.dateFrom || null, to: filtres.dateTo || null }}
    minDate={dateMin}
    onChange={({ from, to }) => changer({ dateFrom: from ?? "", dateTo: to ?? "" })}
  />
);
