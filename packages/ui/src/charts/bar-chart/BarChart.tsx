"use client";

import { chartPalette } from "@clair/theme";
import { BarChart as MantineBarChart } from "@mantine/charts";
import type { CSSProperties } from "react";
import { EmptyState } from "../../core/query-states/QueryStates.tsx";
import classes from "./BarChart.module.css";

/** Une ligne de données : la catégorie et une valeur par série. */
export type BarChartDatum = Record<string, string | number | null>;

export type BarChartSeries = {
  /** Clé de la valeur dans chaque ligne. */
  key: string;
  /** Libellé de la série (légende, infobulle). */
  label: string;
  /** Couleur : variable de token (`var(--clair-graphique-vote-pour)`) ou couleur d'un groupe. */
  color?: string;
};

export type BarChartProps = {
  /** Lignes de données. */
  data: BarChartDatum[];
  /** Clé de la catégorie (axe des libellés). */
  categoryKey: string;
  /** Séries représentées ; une seule pour des barres simples. */
  series: BarChartSeries[];
  /** `default` : barres côte à côte ; `stacked` : empilées ; `percent` : empilées en %. */
  type?: "default" | "stacked" | "percent";
  /** Barres horizontales : à préférer quand les libellés sont longs. */
  horizontal?: boolean;
  /** Hauteur du graphique, en pixels. */
  height?: number;
  /** Unité ajoutée aux valeurs de l'axe (« % »). */
  unit?: string;
  /** Formatage des valeurs (axe, infobulle) ; nombres à la française par défaut. */
  valueFormatter?: (value: number) => string;
  /** Légende des séries ; affichée par défaut dès qu'il y a plusieurs séries. */
  withLegend?: boolean;
  /** Message affiché quand il n'y a aucune donnée. */
  emptyLabel?: string;
  /**
   * Nom de la légende (« Légende : votes par mois »). À donner quand la page a plusieurs
   * graphiques : sinon toutes leurs légendes s'appellent « Légende ».
   */
  legendLabel?: string;
};

type CustomProperties = CSSProperties & Record<`--${string}`, string>;

const numberFormat = new Intl.NumberFormat("fr-FR");

/** Couleur de série passée en variable CSS (token ou couleur de groupe venue des données). */
const colorStyle = (color: string): CustomProperties => ({ "--serie-couleur": color });

/** Largeur de l'axe des catégories en barres horizontales : selon le libellé le plus long, bornée. */
const largeurAxe = (data: BarChartDatum[], categoryKey: string) => {
  const plusLong = Math.max(0, ...data.map((datum) => String(datum[categoryKey] ?? "").length));
  return Math.min(240, Math.max(64, plusLong * 7 + 16));
};

const colorOf = (series: BarChartSeries, index: number) =>
  series.color ?? chartPalette[index % chartPalette.length] ?? "currentColor";

/**
 * Graphique en barres (simples, groupées ou empilées), fondé sur `BarChart` de @mantine/charts.
 * Le dessin est masqué aux lecteurs d'écran : il s'utilise toujours dans un `ChartFrame`, dont
 * le tableau « Afficher les données » est l'alternative textuelle. La légende reste en texte.
 * L'application doit charger `@mantine/charts/styles.css`.
 */
export const BarChart = ({
  data,
  categoryKey,
  series,
  type = "default",
  horizontal = false,
  height = 300,
  unit,
  valueFormatter = (value) => numberFormat.format(value),
  withLegend = series.length > 1,
  emptyLabel = "Aucune donnée à représenter",
  legendLabel = "Légende",
}: BarChartProps) => {
  if (data.length === 0) return <EmptyState title={emptyLabel} />;
  const mantineSeries = series.map((item, index) => ({
    name: item.key,
    label: item.label,
    color: colorOf(item, index),
  }));
  return (
    <div className={classes.barChart}>
      <div aria-hidden="true" className={classes.canvas}>
        <MantineBarChart
          h={height}
          data={data}
          dataKey={categoryKey}
          series={mantineSeries}
          type={type}
          orientation={horizontal ? "vertical" : "horizontal"}
          unit={unit}
          valueFormatter={valueFormatter}
          accessibilityLayer={false}
          textColor="var(--clair-texte-mention)"
          gridColor="var(--clair-bordure-defaut)"
          cursorFill="var(--clair-fond-neutre)"
          yAxisProps={horizontal ? { width: largeurAxe(data, categoryKey) } : undefined}
          tooltipAnimationDuration={0}
        />
      </div>
      {withLegend ? (
        <ul className={classes.legend} aria-label={legendLabel}>
          {series.map((item, index) => (
            <li key={item.key} className={classes.legendItem}>
              <span
                className={classes.swatch}
                aria-hidden="true"
                style={colorStyle(colorOf(item, index))}
              />
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
