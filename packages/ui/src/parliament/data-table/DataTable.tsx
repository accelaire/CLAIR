"use client";

import { Table } from "@mantine/core";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { EmptyState } from "../../core/query-states/QueryStates.tsx";
import classes from "./DataTable.module.css";

export type SortDirection = "ascending" | "descending";

export type DataTableSort = { key: string; direction: SortDirection };

export type DataTableColumn<T> = {
  /** Identifiant de la colonne (clé de tri). */
  key: string;
  /** En-tête visible. */
  header: string;
  /** Contenu de la cellule. */
  cell: (row: T) => ReactNode;
  /** Valeur de tri : la rend triable. `null` est toujours classé en dernier. */
  sortValue?: (row: T) => string | number | null;
  /** Premier sens de tri au clic (`descending` pour un classement). */
  firstDirection?: SortDirection;
  /** Alignement : `end` pour les nombres. */
  align?: "start" | "end";
  /** La cellule identifie la ligne (nom) : rendue en `<th scope="row">`. */
  rowHeader?: boolean;
};

export type DataTableProps<T> = {
  /** Légende obligatoire : nomme le tableau et sa zone de défilement. */
  caption: string;
  /** Masque visuellement la légende (elle reste lue), quand un titre la précède déjà. */
  hideCaption?: boolean;
  columns: DataTableColumn<T>[];
  rows: T[];
  /** Clé stable de chaque ligne. */
  getRowKey: (row: T) => string;
  /** Tri contrôlé (par exemple lu dans l'URL). */
  sort?: DataTableSort | null;
  /** Tri initial, en mode non contrôlé. */
  defaultSort?: DataTableSort | null;
  /** Appelé à chaque changement de tri. */
  onSortChange?: (sort: DataTableSort) => void;
  /** Les lignes arrivent déjà triées (tri côté serveur) : le composant ne les réordonne pas. */
  manualSort?: boolean;
  /** Titre de l'état vide. */
  emptyLabel?: string;
};

const collator = new Intl.Collator("fr-FR", { numeric: true, sensitivity: "base" });

const compareValues = (a: string | number | null, b: string | number | null) => {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return collator.compare(String(a), String(b));
};

const sortRows = <T,>(rows: T[], column: DataTableColumn<T> | undefined, sort: DataTableSort) => {
  const sortValue = column?.sortValue;
  if (!sortValue) return rows;
  const factor = sort.direction === "ascending" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = sortValue(a);
    const vb = sortValue(b);
    if (va === null || vb === null) return compareValues(va, vb);
    return compareValues(va, vb) * factor;
  });
};

const DIRECTION_LABELS: Record<SortDirection, string> = {
  ascending: "ordre croissant",
  descending: "ordre décroissant",
};

/**
 * Tableau de données accessible et triable (base `Table` de Mantine) : légende obligatoire,
 * en-têtes `scope="col"`, tri par boutons dans les en-têtes avec `aria-sort` et annonce du tri,
 * état vide, défilement horizontal dans une zone focusable et nommée sur mobile.
 * Remplace `ClassementsTable` et `ComparisonVotesTable` de apps/web.
 */
export const DataTable = <T,>({
  caption,
  hideCaption = false,
  columns,
  rows,
  getRowKey,
  sort: controlledSort,
  defaultSort = null,
  onSortChange,
  manualSort = false,
  emptyLabel = "Aucune donnée à afficher",
}: DataTableProps<T>) => {
  const [localSort, setLocalSort] = useState<DataTableSort | null>(defaultSort);
  const sort = controlledSort === undefined ? localSort : controlledSort;
  const captionId = useId();

  const sortedRows =
    sort && !manualSort
      ? sortRows(
          rows,
          columns.find((column) => column.key === sort.key),
          sort,
        )
      : rows;

  const changeSort = (column: DataTableColumn<T>) => {
    const next: DataTableSort =
      sort?.key === column.key
        ? {
            key: column.key,
            direction: sort.direction === "ascending" ? "descending" : "ascending",
          }
        : { key: column.key, direction: column.firstDirection ?? "ascending" };
    if (controlledSort === undefined) setLocalSort(next);
    onSortChange?.(next);
  };

  const sortedColumn = sort ? columns.find((column) => column.key === sort.key) : undefined;

  return (
    <div className={classes.dataTable}>
      <section
        className={classes.scroll}
        aria-labelledby={captionId}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: zone défilante, atteignable au clavier (RGAA 7.3, règle axe scrollable-region-focusable)
        tabIndex={0}
      >
        <Table className={classes.table} captionSide="top" highlightOnHover>
          <Table.Caption
            id={captionId}
            className={hideCaption ? "clair-visually-hidden" : classes.caption}
          >
            {caption}
          </Table.Caption>
          <Table.Thead>
            <Table.Tr>
              {columns.map((column) => {
                const direction = sort?.key === column.key ? sort.direction : undefined;
                const active = direction !== undefined;
                const Icon =
                  direction === "ascending"
                    ? ArrowUp
                    : direction === "descending"
                      ? ArrowDown
                      : ArrowUpDown;
                return (
                  <Table.Th
                    key={column.key}
                    scope="col"
                    data-align={column.align ?? "start"}
                    aria-sort={column.sortValue ? direction : undefined}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        className={classes.sortButton}
                        data-active={active || undefined}
                        onClick={() => changeSort(column)}
                      >
                        {column.header}
                        <Icon className={classes.sortIcon} aria-hidden="true" />
                      </button>
                    ) : (
                      column.header
                    )}
                  </Table.Th>
                );
              })}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sortedRows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={columns.length}>
                  <EmptyState title={emptyLabel} />
                </Table.Td>
              </Table.Tr>
            ) : (
              sortedRows.map((row) => (
                <Table.Tr key={getRowKey(row)}>
                  {columns.map((column) =>
                    column.rowHeader ? (
                      <Table.Th
                        key={column.key}
                        scope="row"
                        data-align={column.align ?? "start"}
                        className={classes.rowHeader}
                      >
                        {column.cell(row)}
                      </Table.Th>
                    ) : (
                      <Table.Td key={column.key} data-align={column.align ?? "start"}>
                        {column.cell(row)}
                      </Table.Td>
                    ),
                  )}
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </section>
      <p className="clair-visually-hidden" aria-live="polite">
        {sort && sortedColumn
          ? `Tableau trié par ${sortedColumn.header}, ${DIRECTION_LABELS[sort.direction]}.`
          : ""}
      </p>
    </div>
  );
};
