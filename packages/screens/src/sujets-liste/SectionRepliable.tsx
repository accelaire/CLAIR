"use client";

import type { SujetListItem } from "@clair/data";
import { Button } from "@clair/ui";
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { SujetCard } from "./SujetCard.tsx";
import classes from "./SujetsListeScreen.module.css";
import { VISIBLES_INITIAUX } from "./sections.ts";

type SectionRepliableProps = {
  titre: string;
  sujets: SujetListItem[];
  ouverteParDefaut?: boolean;
};

/**
 * Section de sujets repliable (bouton `aria-expanded`), affichée par lots de douze avec
 * « Voir plus ». Le repli n'est qu'un confort de lecture : il ne change pas l'adresse.
 */
export const SectionRepliable = ({
  titre,
  sujets,
  ouverteParDefaut = true,
}: SectionRepliableProps) => {
  const [ouverte, setOuverte] = useState(ouverteParDefaut);
  const [visibles, setVisibles] = useState(VISIBLES_INITIAUX);
  const id = useId();
  const restants = sujets.length - visibles;

  return (
    <section className={classes.section} aria-labelledby={`${id}-titre`}>
      <h2 id={`${id}-titre`} className={classes.sectionTitle}>
        <button
          type="button"
          className={classes.toggle}
          aria-expanded={ouverte}
          aria-controls={`${id}-liste`}
          onClick={() => setOuverte((valeur) => !valeur)}
        >
          <ChevronDown className={classes.chevron} data-ouvert={ouverte} aria-hidden="true" />
          {titre}
          <span className={`${classes.count} clair-chiffres`}>
            {sujets.length.toLocaleString("fr-FR")}
            <span className="clair-visually-hidden"> sujets</span>
          </span>
        </button>
      </h2>
      <div id={`${id}-liste`} hidden={!ouverte}>
        <ul className={classes.grid}>
          {sujets.slice(0, visibles).map((sujet) => (
            <SujetCard key={sujet.id} sujet={sujet} />
          ))}
        </ul>
        {restants > 0 ? (
          <div className={classes.more}>
            <Button variant="secondaire" onClick={() => setVisibles((n) => n + VISIBLES_INITIAUX)}>
              Voir plus ({Math.min(restants, VISIBLES_INITIAUX)} sur {restants} restants)
            </Button>
          </div>
        ) : null}
        {restants <= 0 && sujets.length > VISIBLES_INITIAUX ? (
          <div className={classes.more}>
            <Button variant="tertiaire" onClick={() => setVisibles(VISIBLES_INITIAUX)}>
              Réduire
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
};
