import { ChevronRight } from "lucide-react";
import { Link } from "../../core/link/Link.tsx";
import classes from "./PageHeader.module.css";

export type BreadcrumbItem = {
  label: string;
  /** Adresse de la page ; absente pour la page courante (dernier élément). */
  href?: string;
};

export type BreadcrumbProps = {
  /** Chemin depuis l'accueil jusqu'à la page courante, incluse (dernier élément). */
  items: BreadcrumbItem[];
};

/**
 * Fil d'Ariane : `nav` nommée « Fil d'Ariane » et liste ordonnée. Le dernier élément est la page
 * courante : il n'est pas un lien et porte `aria-current="page"`. Les séparateurs sont décoratifs.
 */
export const Breadcrumb = ({ items }: BreadcrumbProps) => (
  <nav aria-label="Fil d'Ariane" className={classes.breadcrumb}>
    <ol className={classes.breadcrumbList}>
      {items.map((item, index) => {
        const isCurrent = index === items.length - 1;
        return (
          <li key={`${item.label}-${item.href ?? index}`} className={classes.breadcrumbItem}>
            {index > 0 ? <ChevronRight className={classes.separator} aria-hidden="true" /> : null}
            {isCurrent ? (
              <span aria-current="page" className={classes.current}>
                {item.label}
              </span>
            ) : item.href ? (
              <Link href={item.href} className={classes.breadcrumbLink}>
                {item.label}
              </Link>
            ) : (
              <span>{item.label}</span>
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);
