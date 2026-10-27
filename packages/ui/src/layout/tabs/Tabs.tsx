"use client";

import { Tabs as MantineTabs } from "@mantine/core";
import type { ReactNode } from "react";
import classes from "./Tabs.module.css";

export type TabItem = {
  /** Identifiant de l'onglet, repris tel quel dans l'URL (`?onglet=vote`). */
  value: string;
  /** Libellé visible de l'onglet. */
  label: string;
  /** Nombre d'éléments du panneau, affiché à côté du libellé. */
  count?: number;
  /** Icône décorative placée avant le libellé. */
  icon?: ReactNode;
  /** Contenu du panneau. */
  content: ReactNode;
  disabled?: boolean;
};

export type TabsProps = {
  /** Onglets et leurs panneaux. */
  items: TabItem[];
  /** Nom accessible de la liste d'onglets (« Détail du scrutin »). */
  label: string;
  /** Onglet actif en mode contrôlé (par exemple lu dans l'URL). */
  value?: string;
  /** Onglet actif au premier rendu en mode non contrôlé ; le premier par défaut. */
  defaultValue?: string;
  /** Appelé au changement d'onglet : en mode contrôlé, mettre à jour `value` (et l'URL). */
  onChange?: (value: string) => void;
};

const formatCount = (count: number) => count.toLocaleString("fr-FR");

/**
 * Onglets accessibles (motif « tabs » du W3C, via Mantine) : flèches pour passer d'un onglet à
 * l'autre, panneaux reliés à leur onglet. En mode contrôlé (`value` + `onChange`), l'onglet
 * actif peut vivre dans l'URL. Le compteur est annoncé entre parenthèses.
 */
export const Tabs = ({ items, label, value, defaultValue, onChange }: TabsProps) => (
  <MantineTabs
    value={value}
    defaultValue={value === undefined ? (defaultValue ?? items[0]?.value) : undefined}
    onChange={(next) => {
      if (next !== null) onChange?.(next);
    }}
    color="var(--clair-fond-action)"
    classNames={{
      root: classes.root,
      list: classes.list,
      tab: classes.tab,
      tabSection: classes.section,
      panel: classes.panel,
    }}
  >
    <MantineTabs.List aria-label={label}>
      {items.map((item) => (
        <MantineTabs.Tab
          key={item.value}
          value={item.value}
          disabled={item.disabled}
          leftSection={item.icon ? <span aria-hidden="true">{item.icon}</span> : undefined}
          rightSection={
            item.count === undefined ? undefined : (
              <>
                <span className={classes.count} aria-hidden="true">
                  {formatCount(item.count)}
                </span>
                <span className="clair-visually-hidden"> ({formatCount(item.count)})</span>
              </>
            )
          }
        >
          {item.label}
        </MantineTabs.Tab>
      ))}
    </MantineTabs.List>
    {items.map((item) => (
      <MantineTabs.Panel key={item.value} value={item.value}>
        {item.content}
      </MantineTabs.Panel>
    ))}
  </MantineTabs>
);
