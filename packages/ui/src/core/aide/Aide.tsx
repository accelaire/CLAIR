"use client";

import { Popover } from "@mantine/core";
import { CircleHelp } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link } from "../link/Link.tsx";
import classes from "./Aide.module.css";

export type AideProps = {
  /** Sujet de l'aide : le bouton s'appelle « Aide : <sujet> » pour les lecteurs d'écran. */
  label: string;
  /** Explication affichée dans la bulle. */
  children: ReactNode;
  /** Page qui détaille le sujet (lien « En savoir plus » en bas de la bulle). */
  learnMoreHref?: string;
  learnMoreLabel?: string;
  /** Position préférée de la bulle (elle se replace si la place manque). */
  position?: "top" | "bottom" | "left" | "right";
};

/**
 * Bulle d'aide : bouton « ? » qui ouvre une explication au clic, au toucher ou avec Entrée
 * (et non au seul survol, inaccessible au clavier et sur mobile). Se ferme avec Échap ou par
 * un clic à l'extérieur, et rend le focus au bouton. Rendue en fin de page, la bulle garde le
 * focus quand elle contient le lien « En savoir plus » : sans cela, il serait hors d'atteinte
 * au clavier (RGAA 7 et 12). Remplace `DidacticielTooltip` de apps/web.
 */
export const Aide = ({
  label,
  children,
  learnMoreHref,
  learnMoreLabel = "En savoir plus",
  position = "bottom",
}: AideProps) => {
  const [opened, setOpened] = useState(false);
  return (
    <Popover
      position={position}
      opened={opened}
      onChange={setOpened}
      withArrow
      returnFocus
      trapFocus={Boolean(learnMoreHref)}
      shadow="md"
    >
      <Popover.Target>
        <button
          type="button"
          className={classes.trigger}
          aria-label={`Aide : ${label}`}
          onClick={() => setOpened((value) => !value)}
          onKeyDown={(event) => {
            // Échap ferme aussi la bulle quand le focus est resté sur le bouton.
            if (event.key === "Escape" && opened) {
              event.stopPropagation();
              setOpened(false);
            }
          }}
        >
          <CircleHelp aria-hidden="true" />
        </button>
      </Popover.Target>
      <Popover.Dropdown className={classes.dropdown}>
        <div className={classes.content}>{children}</div>
        {learnMoreHref ? (
          <Link href={learnMoreHref} className={classes.more}>
            {learnMoreLabel}
          </Link>
        ) : null}
      </Popover.Dropdown>
    </Popover>
  );
};
