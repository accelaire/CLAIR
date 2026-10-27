import { Link } from "@clair/ui";
import { ArrowLeft, ArrowRight } from "lucide-react";
import classes from "./ArticleNav.module.css";

export type ArticleLink = { title: string; href: string };

/**
 * Navigation entre les fiches d'une rubrique (Comprendre, Guide) : fiche précédente, retour à
 * la rubrique, fiche suivante. Les sens sont dits en toutes lettres, pas par les seules flèches.
 */
export const ArticleNav = ({
  label,
  previous,
  next,
  index,
}: {
  /** Nom de la navigation (repère `nav`). */
  label: string;
  previous: ArticleLink | null;
  next: ArticleLink | null;
  /** Page d'accueil de la rubrique. */
  index: ArticleLink;
}) => (
  <nav aria-label={label} className={classes.nav}>
    <ul className={classes.list}>
      <li className={classes.item} data-side="previous">
        {previous ? (
          <Link href={previous.href} className={classes.link}>
            <span className={classes.hint}>
              <ArrowLeft className={classes.icon} aria-hidden="true" />
              Précédent
            </span>
            <span className={classes.title}>{previous.title}</span>
          </Link>
        ) : null}
      </li>
      <li className={classes.item} data-side="index">
        <Link href={index.href}>{index.title}</Link>
      </li>
      <li className={classes.item} data-side="next">
        {next ? (
          <Link href={next.href} className={classes.link}>
            <span className={classes.hint}>
              Suivant
              <ArrowRight className={classes.icon} aria-hidden="true" />
            </span>
            <span className={classes.title}>{next.title}</span>
          </Link>
        ) : null}
      </li>
    </ul>
  </nav>
);

/** Fiches voisines d'une fiche dans l'ordre de la rubrique. */
export const neighboursOf = <T extends { slug: string }>(items: readonly T[], slug: string) => {
  const position = items.findIndex((item) => item.slug === slug);
  return {
    previous: position > 0 ? (items[position - 1] ?? null) : null,
    next: position >= 0 ? (items[position + 1] ?? null) : null,
  };
};
