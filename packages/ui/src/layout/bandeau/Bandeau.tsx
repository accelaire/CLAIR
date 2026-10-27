"use client";

import { ArrowRight, Info, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link } from "../../core/link/Link.tsx";
import classes from "./Bandeau.module.css";

export type BandeauTone = "info" | "direct";

export type BandeauProps = {
  /** `info` : annonce ; `direct` : évènement en cours, pastille animée et mention « En direct ». */
  tone?: BandeauTone;
  /** Texte de l'annonce, court (une ligne sur ordinateur). */
  children: ReactNode;
  /** Lien vers la page qui détaille l'annonce. */
  link?: { href: string; label: string; external?: boolean };
  /** Affiche un bouton pour masquer le bandeau. */
  dismissible?: boolean;
  /** Appelé quand le bandeau est masqué (pour mémoriser le choix, par exemple en session). */
  onDismiss?: () => void;
  /** Nom accessible du bouton de fermeture. */
  dismissLabel?: string;
};

/**
 * Bandeau d'annonce en haut de page, au-dessus de l'en-tête (`banner` de `AppShell`). Le ton
 * « direct » ajoute la mention « En direct » et une pastille animée, immobile si la personne
 * réduit les animations. Les données viennent des props : l'application décide de l'afficher.
 * Le message est dans une zone `aria-live` : un bandeau qui apparaît en cours de visite est lu.
 */
export const Bandeau = ({
  tone = "info",
  children,
  link,
  dismissible = false,
  onDismiss,
  dismissLabel = "Masquer le bandeau",
}: BandeauProps) => {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  return (
    <section
      className={classes.bandeau}
      data-tone={tone}
      aria-label={tone === "direct" ? "En direct" : "Annonce"}
    >
      <div className={classes.inner}>
        <div className={classes.message} aria-live="polite">
          {tone === "direct" ? (
            <span className={classes.live}>
              <span className={classes.dot} aria-hidden="true" />
              En direct
            </span>
          ) : (
            <Info className={classes.icon} aria-hidden="true" />
          )}
          <div className={classes.text}>{children}</div>
          {link ? (
            <Link href={link.href} external={link.external} className={classes.link}>
              {link.label}
              {link.external ? null : <ArrowRight className={classes.icon} aria-hidden="true" />}
            </Link>
          ) : null}
        </div>
        {dismissible ? (
          <button
            type="button"
            className={classes.close}
            aria-label={dismissLabel}
            onClick={dismiss}
          >
            <X className={classes.icon} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </section>
  );
};
