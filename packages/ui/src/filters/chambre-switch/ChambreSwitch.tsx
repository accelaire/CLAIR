"use client";

import { SegmentedControl } from "@mantine/core";
import { useId } from "react";
import classes from "./ChambreSwitch.module.css";

/** Chambre choisie ; `""` signifie « les deux chambres » (paramètre omis de l'URL). */
export type ChambreSwitchValue = "" | "assemblee" | "senat";

export type ChambreSwitchProps = {
  /** Chambre choisie (contrôlée : l'écran la lit et l'écrit dans l'URL). */
  value: ChambreSwitchValue;
  onChange: (value: ChambreSwitchValue) => void;
  /** Légende du groupe de choix, lue par les lecteurs d'écran. */
  legend?: string;
  /** Masque visuellement la légende (elle reste annoncée). */
  hideLegend?: boolean;
  /** Propose « Les deux ». Sans lui, seule une chambre peut être choisie. */
  withBoth?: boolean;
  /** Libellés courts (« AN », « Sénat ») pour les espaces étroits. */
  compact?: boolean;
  /** Occupe toute la largeur disponible. */
  fullWidth?: boolean;
  disabled?: boolean;
};

/** Valeur interne de « Les deux » : un bouton radio ne peut pas valoir une chaîne vide. */
const BOTH = "les-deux";

const toValue = (item: string): ChambreSwitchValue =>
  item === "assemblee" || item === "senat" ? item : "";

/**
 * Choix de la chambre : Assemblée nationale, Sénat ou les deux. Groupe de boutons radio
 * natifs avec légende (clavier : flèches). Fusionne `ChambreToggle` (classements) et
 * `FiltreChambre` (fiche parlementaire) de apps/web.
 */
export const ChambreSwitch = ({
  value,
  onChange,
  legend = "Chambre",
  hideLegend = false,
  withBoth = true,
  compact = false,
  fullWidth = false,
  disabled = false,
}: ChambreSwitchProps) => {
  const legendId = useId();
  const data = [
    ...(withBoth ? [{ value: BOTH, label: "Les deux" }] : []),
    {
      value: "assemblee",
      // Le sigle reste explicite pour les lecteurs d'écran.
      label: compact ? (
        <>
          <span aria-hidden="true">AN</span>
          <span className="clair-visually-hidden">Assemblée nationale</span>
        </>
      ) : (
        "Assemblée nationale"
      ),
    },
    { value: "senat", label: "Sénat" },
  ];
  return (
    <fieldset
      className={classes.fieldset}
      disabled={disabled}
      data-full-width={fullWidth || undefined}
    >
      <legend id={legendId} className={hideLegend ? "clair-visually-hidden" : classes.legend}>
        {legend}
      </legend>
      <SegmentedControl
        aria-labelledby={legendId}
        className={classes.control}
        data={data}
        value={value === "" ? (withBoth ? BOTH : "assemblee") : value}
        onChange={(item) => onChange(toValue(item))}
        fullWidth={fullWidth}
        disabled={disabled}
      />
    </fieldset>
  );
};
