"use client";

import "dayjs/locale/fr";
import type { CalendarAriaLabels, DatePickerPreset } from "@mantine/dates";
import { DatePickerInput } from "@mantine/dates";
import dayjs from "dayjs";
import { Calendar } from "lucide-react";
import { useId, useState } from "react";
import { jourAParis } from "../../lib/dates.tsx";
import classes from "./DateRangePicker.module.css";

/** Jour au format `YYYY-MM-DD`, tel qu'il s'écrit dans l'URL (`?du=2024-10-01`). */
export type DateString = string;

/** Plage de dates ; une borne nulle n'est pas filtrée. */
export type DateRange = { from: DateString | null; to: DateString | null };

/** Raccourci proposé à côté du calendrier (« 30 derniers jours », « XVIIe législature »). */
export type DateRangePreset = { label: string; from: DateString; to: DateString };

export type DateRangePickerProps = {
  /** Libellé du champ, toujours présent (masquable visuellement). */
  label?: string;
  /** Masque visuellement le libellé (il reste annoncé). */
  hideLabel?: boolean;
  /** Plage choisie (contrôlée : l'écran la lit et l'écrit dans l'URL). */
  value: DateRange;
  /** Appelé quand une plage complète est choisie, ou à l'effacement. */
  onChange: (value: DateRange) => void;
  /**
   * Raccourcis. Par défaut : `buildDateRangePresets` (périodes glissantes et années). Une liste
   * vide les masque. Les périodes institutionnelles (législatures, sessions) s'y ajoutent.
   */
  presets?: DateRangePreset[];
  /** Date la plus ancienne sélectionnable (début du mandat, par exemple). */
  minDate?: DateString;
  /** Date la plus récente sélectionnable (aujourd'hui par défaut). */
  maxDate?: DateString;
  placeholder?: string;
  /** Nom accessible du bouton d'effacement. */
  clearLabel?: string;
  disabled?: boolean;
};

const FORMAT = "YYYY-MM-DD";

const ariaLabels: CalendarAriaLabels = {
  monthLevelControl: "Choisir le mois",
  yearLevelControl: "Choisir l'année",
  nextMonth: "Mois suivant",
  previousMonth: "Mois précédent",
  nextYear: "Année suivante",
  previousYear: "Année précédente",
  nextDecade: "Décennie suivante",
  previousDecade: "Décennie précédente",
};

/**
 * Raccourcis par défaut, calculés à partir de `today` : 30 derniers jours, 3 et 12 derniers
 * mois, « depuis `minDate` » (si `startLabel`), puis une entrée par année civile (depuis
 * l'année de `minDate`, sinon les trois dernières années). Repris de apps/web.
 */
export const buildDateRangePresets = ({
  today = jourAParis(),
  minDate,
  startLabel,
}: {
  today?: DateString;
  minDate?: DateString;
  startLabel?: string;
} = {}): DateRangePreset[] => {
  const end = dayjs(today);
  const to = end.format(FORMAT);
  const presets: DateRangePreset[] = [
    { label: "30 derniers jours", from: end.subtract(30, "day").format(FORMAT), to },
    { label: "3 derniers mois", from: end.subtract(3, "month").format(FORMAT), to },
    { label: "12 derniers mois", from: end.subtract(1, "year").format(FORMAT), to },
  ];
  if (minDate && startLabel) presets.unshift({ label: startLabel, from: minDate, to });
  const lastYear = end.year();
  const firstYear = minDate ? dayjs(minDate).year() : lastYear - 2;
  for (let year = lastYear; year >= firstYear; year--) {
    presets.push({
      label: `Année ${year}`,
      from: `${year}-01-01`,
      to: year === lastYear ? to : `${year}-12-31`,
    });
  }
  return presets;
};

/**
 * Choix d'une plage de dates : calendrier en français et raccourcis (périodes glissantes,
 * années, périodes institutionnelles). La plage n'est transmise qu'une fois complète ;
 * une sélection abandonnée (Échap, clic à l'extérieur) laisse la plage précédente.
 * Remplace `components/DateRangePicker.tsx` de apps/web.
 */
export const DateRangePicker = ({
  label = "Période",
  hideLabel = false,
  value,
  onChange,
  presets,
  minDate,
  maxDate,
  placeholder = "Toutes les dates",
  clearLabel = "Effacer la période",
  disabled = false,
}: DateRangePickerProps) => {
  const [draft, setDraft] = useState<[DateString | null, DateString | null]>([
    value.from,
    value.to,
  ]);
  const [previous, setPrevious] = useState(value);
  if (previous.from !== value.from || previous.to !== value.to) {
    setPrevious(value);
    setDraft([value.from, value.to]);
  }

  // Même identifiant pour le champ et la fenêtre du calendrier : celle-ci est nommée par le
  // libellé du champ (sinon Mantine la relie à un identifiant absent de la page).
  const id = useId();
  const shortcuts = presets ?? buildDateRangePresets({ today: maxDate, minDate });

  const handleChange = ([from, to]: [DateString | null, DateString | null]) => {
    if (from && to) {
      setDraft([from, to]);
      onChange({ from, to });
    } else if (!from && !to) {
      // Mantine efface une plage inachevée à la fermeture : on revient à la plage choisie.
      setDraft([value.from, value.to]);
    } else {
      setDraft([from, to]);
    }
  };

  const clear = () => {
    setDraft([null, null]);
    onChange({ from: null, to: null });
  };

  return (
    <DatePickerInput
      type="range"
      id={id}
      popoverProps={{ id }}
      label={label}
      classNames={{
        label: hideLabel ? "clair-visually-hidden" : classes.label,
        placeholder: classes.placeholder,
        datePickerRoot: classes.pickerRoot,
        presetsList: classes.presetsList,
      }}
      value={draft}
      onChange={handleChange}
      presets={shortcuts.map(
        (preset): DatePickerPreset<"range"> => ({
          label: preset.label,
          value: [preset.from, preset.to],
        }),
      )}
      locale="fr"
      valueFormat="D MMM YYYY"
      ariaLabels={ariaLabels}
      allowSingleDateInRange
      minDate={minDate}
      maxDate={maxDate ?? jourAParis()}
      placeholder={placeholder}
      leftSection={<Calendar className={classes.icon} aria-hidden="true" />}
      clearable
      clearButtonProps={{ "aria-label": clearLabel, onClick: clear }}
      disabled={disabled}
    />
  );
};
