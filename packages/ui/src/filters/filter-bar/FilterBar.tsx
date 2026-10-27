"use client";

import { Drawer } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { RotateCcw, SlidersHorizontal, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../core/button/Button.tsx";
import classes from "./FilterBar.module.css";

/** Filtre actif, affiché en pastille retirable (« Groupe : SOC »). */
export type ActiveFilter = {
  /** Clé stable (nom du paramètre d'URL et valeur, par exemple `groupe=SOC`). */
  id: string;
  /** Libellé lisible hors contexte. */
  label: string;
  /** Retire ce filtre (l'écran met l'URL à jour). */
  onRemove: () => void;
};

export type FilterBarProps = {
  /** Filtres (ChambreSwitch, MultiSelectFilter…) : en ligne sur grand écran, dans un tiroir sur mobile. */
  children: ReactNode;
  /** Recherche, toujours visible (aussi sur mobile, à côté du bouton « Filtres »). */
  search?: ReactNode;
  /** Filtres actifs, listés en pastilles retirables. */
  activeFilters?: ActiveFilter[];
  /** Nombre de filtres actifs, si différent du nombre de pastilles. */
  activeCount?: number;
  /** Réinitialise tous les filtres ; le bouton n'apparaît que si un filtre est actif. */
  onReset?: () => void;
  /** Nom du groupe de filtres et titre du tiroir. */
  label?: string;
};

/** « 1 filtre actif », « 3 filtres actifs ». */
const countLabel = (count: number) =>
  `${count} filtre${count > 1 ? "s" : ""} actif${count > 1 ? "s" : ""}`;

/**
 * Barre de filtres d'une liste : recherche, filtres, compteur de filtres actifs, pastilles
 * retirables et bouton « Réinitialiser ». Sur mobile, les filtres passent dans un tiroir ouvert
 * par le bouton « Filtres ». L'état reste dans l'URL : la barre ne fait que l'afficher.
 * Remplace `components/FilterBar.tsx` de apps/web (sans framer-motion).
 */
export const FilterBar = ({
  children,
  search,
  activeFilters = [],
  activeCount,
  onReset,
  label = "Filtres",
}: FilterBarProps) => {
  const [opened, { open, close }] = useDisclosure(false);
  const count = activeCount ?? activeFilters.length;
  const canReset = count > 0 && onReset !== undefined;

  return (
    <section className={classes.root} aria-label={label}>
      <div className={classes.bar}>
        {search ? <div className={classes.search}>{search}</div> : null}
        <div className={classes.filters}>{children}</div>
        <div className={classes.mobileOnly}>
          <Button
            variant="secondaire"
            icon={<SlidersHorizontal />}
            aria-expanded={opened}
            aria-haspopup="dialog"
            onClick={open}
          >
            {label}
            {count > 0 ? (
              <>
                <span className={`${classes.count} clair-chiffres`} aria-hidden="true">
                  {count}
                </span>
                <span className="clair-visually-hidden">, {countLabel(count)}</span>
              </>
            ) : null}
          </Button>
        </div>
        {canReset ? (
          <div className={classes.desktopOnly}>
            <Button variant="tertiaire" icon={<RotateCcw />} onClick={onReset}>
              Réinitialiser
            </Button>
          </div>
        ) : null}
      </div>

      {activeFilters.length > 0 ? (
        <ul className={classes.pills} aria-label="Filtres actifs">
          {activeFilters.map((filter) => (
            <li key={filter.id} className={classes.pill}>
              <span>{filter.label}</span>
              <Button
                variant="tertiaire"
                size="sm"
                icon={<X />}
                aria-label={`Retirer le filtre ${filter.label}`}
                className={classes.remove}
                onClick={filter.onRemove}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <Drawer
        opened={opened}
        onClose={close}
        title={label}
        position="bottom"
        size="auto"
        closeButtonProps={{ "aria-label": "Fermer les filtres" }}
        classNames={{ body: classes.drawerBody }}
      >
        <div className={classes.drawerFilters}>{children}</div>
        <div className={classes.drawerActions}>
          {canReset ? (
            <Button variant="secondaire" icon={<RotateCcw />} onClick={onReset}>
              Réinitialiser
            </Button>
          ) : null}
          <Button variant="primaire" onClick={close}>
            Afficher les résultats
          </Button>
        </div>
      </Drawer>
    </section>
  );
};
