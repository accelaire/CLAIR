"use client";

import { ArrowRight, Info, Sparkles, TriangleAlert } from "lucide-react";
import { type ReactNode, useId } from "react";
import { Button } from "../button/Button.tsx";
import classes from "./Callout.module.css";

export type CalloutTone = "info" | "mise-en-avant" | "avertissement";

export type CalloutAction = {
  label: string;
  href: string;
  /** Lien vers un autre site : nouvel onglet, annoncé aux lecteurs d'écran. */
  external?: boolean;
};

export type CalloutProps = {
  /** Ton de l'encart ; l'icône et le titre portent le sens, pas la couleur seule. */
  tone?: CalloutTone;
  title?: ReactNode;
  /** Niveau du titre, selon la hiérarchie de la page (`h3` par défaut). */
  titleAs?: "h2" | "h3" | "h4" | "h5" | "h6";
  /** Icône décorative ; par défaut celle du ton, `null` pour n'en afficher aucune. */
  icon?: ReactNode;
  /** Action unique : un lien (« Voir les candidats », « Soutenir CLAIR »). */
  action?: CalloutAction;
  /**
   * Élément racine. `section` ou `aside` créent un repère nommé par le titre : à réserver aux
   * encarts qui méritent d'être atteints depuis la liste des repères.
   */
  as?: "div" | "section" | "aside";
  children?: ReactNode;
};

const defaultIcons: Record<CalloutTone, ReactNode> = {
  info: <Info />,
  "mise-en-avant": <Sparkles />,
  avertissement: <TriangleAlert />,
};

/**
 * Encart de mise en avant : information, invitation (« Aller plus loin », appel au don) ou
 * avertissement, avec un titre, un contenu et au plus une action. Remplace
 * `FicheCompareCallout`, `SiegeRenouvelableCallout`, `SoutenirCallout` et `EncartResultats`.
 */
export const Callout = ({
  tone = "info",
  title,
  titleAs: Heading = "h3",
  icon,
  action,
  as: Root = "div",
  children,
}: CalloutProps) => {
  const titleId = useId();
  const visual = icon === undefined ? defaultIcons[tone] : icon;
  const labelled = Root !== "div" && title !== undefined;
  return (
    <Root
      className={classes.callout}
      data-tone={tone}
      aria-labelledby={labelled ? titleId : undefined}
    >
      {visual ? (
        <span className={classes.icon} aria-hidden="true">
          {visual}
        </span>
      ) : null}
      <div className={classes.content}>
        {title !== undefined ? (
          <Heading id={titleId} className={classes.title}>
            {title}
          </Heading>
        ) : null}
        {children !== undefined ? <div className={classes.body}>{children}</div> : null}
      </div>
      {action ? (
        <div className={classes.action}>
          {action.external ? (
            <Button href={action.href} external size="sm">
              {action.label}
            </Button>
          ) : (
            <Button href={action.href} size="sm" icon={<ArrowRight />} iconPosition="end">
              {action.label}
            </Button>
          )}
        </div>
      ) : null}
    </Root>
  );
};
