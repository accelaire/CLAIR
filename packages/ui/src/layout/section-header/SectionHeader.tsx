import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "../../core/link/Link.tsx";
import classes from "./SectionHeader.module.css";

export type SectionHeaderProps = {
  /** Titre de la section ; il complète aussi le nom accessible du lien « Voir tout ». */
  title: string;
  /** Niveau du titre, selon la hiérarchie de la page (`h2` sous le `h1`, `h3` dessous). */
  level?: 2 | 3;
  /** Phrase d'explication sous le titre. */
  description?: ReactNode;
  /** Lien interne vers la liste complète. */
  seeAllHref?: string;
  /** Libellé visible du lien. */
  seeAllLabel?: string;
  /** Identifiant du titre, pour une ancre ou un `aria-labelledby`. */
  id?: string;
};

/**
 * Titre de section : titre de niveau 2 ou 3, description et lien « Voir tout » optionnels.
 * Le lien est nommé par le titre (« Voir tout : Scrutins récents ») pour rester explicite hors
 * contexte. Choisir le niveau selon la hiérarchie de la page, jamais pour la taille du texte.
 */
export const SectionHeader = ({
  title,
  level = 2,
  description,
  seeAllHref,
  seeAllLabel = "Voir tout",
  id,
}: SectionHeaderProps) => {
  const Heading = level === 3 ? "h3" : "h2";
  return (
    <div className={classes.header}>
      <div className={classes.text}>
        <Heading id={id} className={classes.title} data-level={level}>
          {title}
        </Heading>
        {description ? <div className={classes.description}>{description}</div> : null}
      </div>
      {seeAllHref ? (
        <Link href={seeAllHref} className={classes.seeAll}>
          {seeAllLabel}
          <span className="clair-visually-hidden"> : {title}</span>
          <ArrowRight className={classes.arrow} aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
};
