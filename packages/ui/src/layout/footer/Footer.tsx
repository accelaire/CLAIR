import type { ReactNode } from "react";
import { Link } from "../../core/link/Link.tsx";
import classes from "./Footer.module.css";

export type FooterLink = { label: string; href: string; external?: boolean; icon?: ReactNode };
export type FooterColumn = { title: string; links: FooterLink[] };

export type FooterProps = {
  tagline?: string;
  columns: FooterColumn[];
  /** Réseaux : un lien externe par icône, avec un nom accessible. */
  social?: { label: string; href: string; icon: ReactNode }[];
  /** Producteurs des données affichées. */
  sources?: { label: string; href: string }[];
  /**
   * Année du « © ». À passer depuis le serveur quand le pied de page est rendu dans un composant
   * client : calculée des deux côtés, elle pourrait différer le 31 décembre à minuit.
   */
  year?: number;
  /** Nom de la marque, lien vers l'accueil. */
  brand?: string;
  /** Nom accessible du lien de la marque. */
  brandLabel?: string;
};

/** Pied de page : marque, colonnes de liens, réseaux, sources des données. */
export const Footer = ({
  tagline,
  columns,
  social = [],
  sources = [],
  year,
  brand = "CLAIR",
  brandLabel = `${brand}, accueil`,
}: FooterProps) => (
  <footer className={classes.footer}>
    <div className={classes.inner}>
      <div className={classes.top}>
        <div>
          <Link href="/" className={classes.brand} aria-label={brandLabel}>
            {brand}
          </Link>
          {tagline ? <p className={classes.tagline}>{tagline}</p> : null}
        </div>
        {social.length > 0 ? (
          <ul className={classes.social}>
            {social.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={classes.socialLink}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  <span className="clair-visually-hidden">{item.label} (nouvelle fenêtre)</span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className={classes.columns}>
        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className={classes.columnTitle}>{column.title}</h2>
            <ul className={classes.links}>
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} external={link.external} className={classes.link}>
                    {link.icon ? <span aria-hidden="true">{link.icon}</span> : null}
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <p className={classes.bottom}>
        © {year ?? new Date().getFullYear()} {brand}.
        {sources.length > 0 ? (
          <>
            {" "}
            Sources :{" "}
            {sources.map((source, index) => (
              <span key={source.href}>
                {index > 0 ? " · " : null}
                <Link href={source.href} external className={classes.source}>
                  {source.label}
                </Link>
              </span>
            ))}
          </>
        ) : null}
      </p>
    </div>
  </footer>
);
