import type { ReactNode } from "react";
import { SkipLink } from "../../core/skip-link/SkipLink.tsx";
import classes from "./AppShell.module.css";

export type AppShellProps = {
  header: ReactNode;
  footer: ReactNode;
  /** Bandeau au-dessus de l'en-tête (direct, annonce). */
  banner?: ReactNode;
  children: ReactNode;
};

/**
 * Cadre de toutes les pages : lien d'évitement, en-tête, contenu principal (`main#contenu`),
 * pied de page.
 */
export const AppShell = ({ header, footer, banner, children }: AppShellProps) => (
  <div className={classes.shell}>
    <SkipLink target="contenu" />
    {banner}
    {header}
    <main id="contenu" tabIndex={-1} className={classes.main}>
      {children}
    </main>
    {footer}
  </div>
);
