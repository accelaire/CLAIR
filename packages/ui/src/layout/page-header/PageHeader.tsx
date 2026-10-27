import type { ReactNode } from "react";
import { Breadcrumb, type BreadcrumbItem } from "./Breadcrumb.tsx";
import classes from "./PageHeader.module.css";

export type PageHeaderProps = {
  /** Titre de la page, rendu dans l'unique `h1`. */
  title: ReactNode;
  /** Chapeau : une ou deux phrases qui disent ce que montre la page. */
  description?: ReactNode;
  /** Fil d'Ariane, de l'accueil à la page courante incluse. */
  breadcrumb?: BreadcrumbItem[];
  /** Badges de statut ou de catégorie, sous le titre (composant `Badge`). */
  badges?: ReactNode;
  /** Actions de la page (partager, exporter…), à droite sur grand écran. */
  actions?: ReactNode;
};

/**
 * En-tête de page : fil d'Ariane optionnel, titre (le seul `h1` de la page), badges, chapeau et
 * actions. À placer une seule fois par page, en tête du contenu principal.
 */
export const PageHeader = ({
  title,
  description,
  breadcrumb,
  badges,
  actions,
}: PageHeaderProps) => (
  <header className={classes.header}>
    {breadcrumb && breadcrumb.length > 0 ? <Breadcrumb items={breadcrumb} /> : null}
    <div className={classes.top}>
      <div className={classes.heading}>
        <h1 className={classes.title}>{title}</h1>
        {badges ? <div className={classes.badges}>{badges}</div> : null}
        {description ? <div className={classes.description}>{description}</div> : null}
      </div>
      {actions ? <div className={classes.actions}>{actions}</div> : null}
    </div>
  </header>
);
