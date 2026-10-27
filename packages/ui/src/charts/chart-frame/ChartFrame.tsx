"use client";

import { Table } from "@mantine/core";
import { ChevronDown } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { Button } from "../../core/button/Button.tsx";
import { Link } from "../../core/link/Link.tsx";
import { type Provenance, ProvenanceLabel } from "../../core/provenance-label/ProvenanceLabel.tsx";
import classes from "./ChartFrame.module.css";

export type ChartTableColumn = {
  /** Clé de la valeur dans chaque ligne. */
  key: string;
  /** En-tête de colonne. */
  label: string;
};

export type ChartTableValue = string | number | null;

/** Alternative textuelle du graphique : les mêmes données, en tableau. */
export type ChartTable = {
  /** Légende du tableau (lue par les lecteurs d'écran). */
  caption: string;
  columns: ChartTableColumn[];
  rows: Record<string, ChartTableValue>[];
};

export type ChartFrameProps = {
  /** Titre du graphique. */
  title: string;
  /** Sous-titre : périmètre, période, unité. */
  subtitle?: ReactNode;
  /** Niveau du titre dans la page. */
  headingLevel?: 2 | 3 | 4;
  /** Source des données, avec un lien externe si elle est consultable. */
  source?: { label: string; href?: string };
  /** Nature de la donnée représentée (officielle, calculée par CLAIR, IA), toujours affichée. */
  provenance: Provenance;
  /** Adresse de la méthodologie de calcul : le libellé de provenance devient un lien. */
  methodologyHref?: string;
  /** Précision sur la méthode ou le périmètre (« Moyenne sur la session 2024-2025 »). */
  note?: ReactNode;
  /** Alternative textuelle obligatoire : tableau révélé par « Afficher les données ». */
  table: ChartTable;
  /** Le graphique. */
  children: ReactNode;
};

const numberFormat = new Intl.NumberFormat("fr-FR");

const formatCell = (value: ChartTableValue) => {
  if (value === null) return "—";
  return typeof value === "number" ? numberFormat.format(value) : value;
};

/**
 * Cadre commun d'un graphique : titre, sous-titre, nature de la donnée, source, et une
 * alternative textuelle obligatoire (tableau des données, affiché à la demande).
 * Tout graphique de CLAIR s'affiche dans ce cadre (RGAA : alternative aux images complexes).
 */
export const ChartFrame = ({
  title,
  subtitle,
  headingLevel = 2,
  source,
  provenance,
  methodologyHref,
  note,
  table,
  children,
}: ChartFrameProps) => {
  const [tableOpen, setTableOpen] = useState(false);
  const titleId = useId();
  const tableId = useId();
  const Heading = `h${headingLevel}` as const;

  return (
    <section className={classes.frame} aria-labelledby={titleId}>
      <header className={classes.header}>
        <Heading id={titleId} className={classes.title}>
          {title}
        </Heading>
        {subtitle ? <p className={classes.subtitle}>{subtitle}</p> : null}
      </header>

      <div className={classes.chart}>{children}</div>

      <footer className={classes.footer}>
        <div className={classes.meta}>
          <ProvenanceLabel provenance={provenance} methodologyHref={methodologyHref} />
          {note ? <span>{note}</span> : null}
          {source ? (
            <span className={classes.source}>
              Source :{" "}
              {source.href ? (
                <Link href={source.href} external>
                  {source.label}
                </Link>
              ) : (
                source.label
              )}
            </span>
          ) : null}
        </div>
        <Button
          variant="secondaire"
          size="sm"
          icon={<ChevronDown className={classes.chevron} />}
          iconPosition="end"
          aria-expanded={tableOpen}
          aria-controls={tableId}
          data-open={tableOpen || undefined}
          className={classes.toggle}
          onClick={() => setTableOpen((open) => !open)}
        >
          {tableOpen ? "Masquer les données" : "Afficher les données"}
        </Button>
      </footer>

      <div id={tableId} className={classes.tableWrapper} hidden={!tableOpen}>
        <Table className={classes.table} captionSide="top">
          <Table.Caption className={classes.caption}>{table.caption}</Table.Caption>
          <Table.Thead>
            <Table.Tr>
              {table.columns.map((column) => (
                <Table.Th key={column.key} scope="col">
                  {column.label}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {table.rows.map((row, index) => (
              <Table.Tr key={`${index}-${String(row[table.columns[0]?.key ?? ""])}`}>
                {table.columns.map((column) => {
                  const value = row[column.key] ?? null;
                  return (
                    <Table.Td
                      key={column.key}
                      data-numeric={typeof value === "number" || undefined}
                    >
                      {formatCell(value)}
                    </Table.Td>
                  );
                })}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </div>
    </section>
  );
};
