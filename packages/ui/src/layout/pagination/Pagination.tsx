"use client";

import { usePagination } from "@mantine/hooks";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigation } from "../../lib/navigation.tsx";
import classes from "./Pagination.module.css";

type PaginationBaseProps = {
  /** Page courante, à partir de 1. */
  page: number;
  /** Nombre total de pages. Rien n'est affiché s'il n'y en a qu'une. */
  total: number;
  /** Pages voisines affichées de part et d'autre de la page courante. */
  siblings?: number;
  /** Nom accessible de la navigation. */
  label?: string;
};

export type PaginationProps = PaginationBaseProps &
  (
    | {
        /** Adresse d'une page : les pages sont de vrais liens, explorables par les moteurs. */
        hrefFor: (page: number) => string;
        onChange?: never;
      }
    | {
        /** Changement de page sans changer d'adresse : les pages sont des boutons. */
        onChange: (page: number) => void;
        hrefFor?: never;
      }
  );

type ControlProps = {
  target: number;
  className: string | undefined;
  disabled?: boolean;
  current?: boolean;
  rel?: string;
  children: ReactNode;
};

/**
 * Pagination : `nav` nommée, pages en liens (`hrefFor`, à préférer pour le référencement) ou en
 * boutons (`onChange`). La page courante porte `aria-current="page"`. Sur un écran étroit, seuls
 * « Précédent », « Page n sur N » et « Suivant » restent affichés.
 */
export const Pagination = ({
  page: pageDemandee,
  total,
  siblings = 1,
  label = "Pagination",
  hrefFor,
  onChange,
}: PaginationProps) => {
  const { Link: RouterLink } = useNavigation();
  // Page bornée : une adresse au-delà de la dernière page (?page=9 sur 3) ne doit pas afficher
  // « Page 9 sur 3 » ni proposer une page « Suivante » inexistante.
  const page = Math.min(Math.max(1, Math.trunc(pageDemandee) || 1), Math.max(1, total));
  const { range } = usePagination({ total, page, siblings, boundaries: 1 });

  if (total <= 1) return null;

  const control = ({
    target,
    className,
    disabled = false,
    current,
    rel,
    children,
  }: ControlProps) => {
    if (hrefFor) {
      return disabled ? (
        <span className={className} data-disabled="">
          {children}
        </span>
      ) : (
        <RouterLink
          href={hrefFor(target)}
          className={className}
          rel={rel}
          aria-current={current ? "page" : undefined}
        >
          {children}
        </RouterLink>
      );
    }
    return (
      <button
        type="button"
        className={className}
        disabled={disabled}
        aria-current={current ? "page" : undefined}
        onClick={() => onChange?.(target)}
      >
        {children}
      </button>
    );
  };

  return (
    <nav aria-label={label} className={classes.nav}>
      <ul className={classes.list}>
        <li>
          {control({
            target: page - 1,
            className: classes.control,
            disabled: page <= 1,
            rel: "prev",
            children: (
              <>
                <ChevronLeft className={classes.icon} aria-hidden="true" />
                Précédent
              </>
            ),
          })}
        </li>
        {range.map((item, index) =>
          item === "dots" ? (
            <li
              key={index < range.indexOf(page) ? "dots-avant" : "dots-apres"}
              className={classes.dots}
              aria-hidden="true"
            >
              …
            </li>
          ) : (
            <li key={item} className={classes.pageItem}>
              {control({
                target: item,
                className: classes.page,
                current: item === page,
                children: (
                  <>
                    <span className="clair-visually-hidden">Page </span>
                    {item}
                  </>
                ),
              })}
            </li>
          ),
        )}
        <li className={classes.summary}>
          Page {page} sur {total}
        </li>
        <li>
          {control({
            target: page + 1,
            className: classes.control,
            disabled: page >= total,
            rel: "next",
            children: (
              <>
                Suivant
                <ChevronRight className={classes.icon} aria-hidden="true" />
              </>
            ),
          })}
        </li>
      </ul>
    </nav>
  );
};
