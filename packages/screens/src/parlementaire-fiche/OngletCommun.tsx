"use client";

import { ChambreSwitch, DateRangePicker } from "@clair/ui";
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
  /** Élu passé par l'Assemblée et par le Sénat : le filtre de chambre est proposé. */
  deuxChambres?: boolean;
};

/**
 * Filtres communs aux listes : période (`dateFrom`, `dateTo` dans l'URL) et, pour un élu passé
 * par les deux chambres, chambre (`chambre`), comme `FiltreChambre` de apps/web. Ailleurs, le
 * choix de la chambre n'aurait qu'une réponse possible.
 */
export const PeriodeFiltre = ({
  filtres,
  changer,
  dateMin,
  deuxChambres = false,
}: Pick<OngletProps, "filtres" | "changer" | "dateMin" | "deuxChambres">) => (
  <>
    <DateRangePicker
      label="Période"
      placeholder="Toute la période"
      value={{ from: filtres.dateFrom || null, to: filtres.dateTo || null }}
      minDate={dateMin}
      onChange={({ from, to }) => changer({ dateFrom: from ?? "", dateTo: to ?? "" })}
    />
    {deuxChambres ? (
      <ChambreSwitch
        legend="Chambre"
        withBoth
        value={filtres.chambre}
        onChange={(chambre) => changer({ chambre })}
      />
    ) : null}
  </>
);
