"use client";

import { NativeSelect } from "@mantine/core";
import { ArrowUpDown } from "lucide-react";
import classes from "./SortSelect.module.css";

export type SortOption = {
  /** Valeur écrite dans l'URL (`?tri=presence`). */
  value: string;
  /** Libellé affiché (« Présence »). */
  label: string;
};

export type SortSelectProps = {
  /** Tri choisi (contrôlé : l'écran le lit et l'écrit dans l'URL). */
  value: string;
  onChange: (value: string) => void;
  /** Critères de tri proposés, dans l'ordre d'affichage. */
  options: SortOption[];
  /** Libellé du champ, toujours présent (masquable visuellement). */
  label?: string;
  /** Masque visuellement le libellé (il reste annoncé). */
  hideLabel?: boolean;
  disabled?: boolean;
};

/**
 * Choix du tri d'une liste. Liste déroulante native (la plus accessible et la plus confortable
 * sur mobile), toujours libellée. Remplace `classements/SortSelect.tsx` de apps/web.
 */
export const SortSelect = ({
  value,
  onChange,
  options,
  label = "Trier par",
  hideLabel = false,
  disabled = false,
}: SortSelectProps) => (
  <NativeSelect
    label={label}
    classNames={{
      root: classes.root,
      label: hideLabel ? "clair-visually-hidden" : classes.label,
    }}
    data={options}
    value={value}
    onChange={(event) => onChange(event.currentTarget.value)}
    disabled={disabled}
    leftSection={<ArrowUpDown className={classes.icon} aria-hidden="true" />}
  />
);
