"use client";

import { type ComboboxItem, isOptionsGroup, MultiSelect, type OptionsFilter } from "@mantine/core";
import classes from "./MultiSelectFilter.module.css";

export type MultiSelectFilterOption = {
  /** Valeur écrite dans l'URL (`?groupe=SOC&groupe=EPR`). */
  value: string;
  /** Libellé affiché et cherché. */
  label: string;
  /** Nombre d'éléments correspondants, affiché à droite de l'option. */
  count?: number;
};

export type MultiSelectFilterProps = {
  /** Libellé visible du champ (« Groupes politiques »). */
  label: string;
  /** Options proposées. */
  options: MultiSelectFilterOption[];
  /** Valeurs choisies (contrôlées : l'écran les lit et les écrit dans l'URL). */
  value: string[];
  onChange: (value: string[]) => void;
  /** Texte d'invite quand rien n'est choisi. */
  placeholder?: string;
  /** Nombre maximal de valeurs choisies. */
  maxValues?: number;
  /** Annonce du nombre d'éléments choisis (« 2 groupes choisis »). */
  countLabel?: (count: number) => string;
  disabled?: boolean;
};

const numberFormat = new Intl.NumberFormat("fr-FR");

/** « Aucun élément choisi », « 1 élément choisi », « 3 éléments choisis ». */
const defaultCountLabel = (count: number) =>
  count === 0
    ? "Aucun élément choisi"
    : `${count} élément${count > 1 ? "s" : ""} choisi${count > 1 ? "s" : ""}`;

/** Ignore la casse et les accents : « ecologiste » trouve « Écologiste ». */
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const accentInsensitiveFilter: OptionsFilter = ({ options, search }) => {
  const query = normalize(search);
  if (query === "") return options;
  return options.filter((item) => !isOptionsGroup(item) && normalize(item.label).includes(query));
};

/**
 * Filtre à choix multiple avec recherche (insensible aux accents) : les choix apparaissent en
 * pastilles, leur nombre est affiché à côté du libellé. Pour les lecteurs d'écran, il est dit une
 * seule fois à chaque fois : en description du champ quand on y arrive, par la zone de statut
 * quand il change. Une limite (`maxValues`) est annoncée, et signalée quand elle est atteinte.
 * Remplace `components/MultiSelectFilter.tsx` de apps/web.
 */
export const MultiSelectFilter = ({
  label,
  options,
  value,
  onChange,
  placeholder = "Rechercher…",
  maxValues,
  countLabel = defaultCountLabel,
  disabled = false,
}: MultiSelectFilterProps) => {
  const counts = new Map(options.map((option) => [option.value, option.count]));
  const atteinte = maxValues !== undefined && value.length >= maxValues;
  const limite =
    maxValues === undefined
      ? null
      : atteinte
        ? `Limite de ${maxValues} choix atteinte.`
        : `${maxValues} choix au maximum.`;
  const announcement = [countLabel(value.length), limite].filter(Boolean).join(". ");
  const renderOption = ({ option }: { option: ComboboxItem }) => {
    const count = counts.get(option.value);
    return (
      <span className={classes.option}>
        <span className={classes.optionLabel}>{option.label}</span>
        {count !== undefined ? (
          <span className={`${classes.optionCount} clair-chiffres`}>
            {numberFormat.format(count)}
          </span>
        ) : null}
      </span>
    );
  };

  return (
    <div className={classes.root}>
      <MultiSelect
        label={
          <span className={classes.label}>
            {label}
            {value.length > 0 ? (
              <span className={`${classes.count} clair-chiffres`} aria-hidden="true">
                {value.length}
              </span>
            ) : null}
          </span>
        }
        data={options.map(({ value: optionValue, label: optionLabel }) => ({
          value: optionValue,
          label: optionLabel,
        }))}
        value={value}
        onChange={onChange}
        description={announcement}
        descriptionProps={{ className: "clair-visually-hidden" }}
        placeholder={value.length === 0 ? placeholder : undefined}
        searchable
        filter={accentInsensitiveFilter}
        nothingFoundMessage="Aucun résultat"
        clearable
        clearButtonProps={{
          "aria-label": "Tout désélectionner",
          "aria-hidden": false,
          tabIndex: 0,
        }}
        maxValues={maxValues}
        renderOption={renderOption}
        hidePickedOptions={false}
        withCheckIcon
        disabled={disabled}
        comboboxProps={{ withinPortal: true }}
      />
      <span role="status" className="clair-visually-hidden">
        {announcement}
      </span>
      {atteinte ? (
        <p className={classes.limite} aria-hidden="true">
          {limite}
        </p>
      ) : null}
    </div>
  );
};
