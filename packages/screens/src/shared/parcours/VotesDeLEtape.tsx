"use client";

import type { SujetVoteEtape } from "@clair/data";
import { Badge, Link, parseStatut, StatutBadge } from "@clair/ui";
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { scrutinHref } from "../scrutins.ts";
import classes from "./VotesDeLEtape.module.css";

type VotesDeLEtapeProps = {
  scrutins: SujetVoteEtape[];
  /** Date lisible de l'étape, pour distinguer les boutons aux lecteurs d'écran. */
  date: string;
};

/**
 * Votes d'une étape du parcours (séance ou réunion), repliés derrière un bouton « N votes »
 * (`aria-expanded`), comme `ParcoursParlementaire.tsx` de apps/web : un texte budgétaire compte
 * des centaines de votes. Rend le bouton puis la liste : le parent les place dans sa ligne
 * (`flex-wrap`), la liste prenant toute la largeur. Rien si l'étape n'a aucun vote.
 */
export const VotesDeLEtape = ({ scrutins, date }: VotesDeLEtapeProps) => {
  const [ouvert, setOuvert] = useState(false);
  const id = useId();
  if (scrutins.length === 0) return null;
  const nombre = scrutins.length;
  return (
    <>
      <button
        type="button"
        className={classes.bascule}
        aria-expanded={ouvert}
        aria-controls={id}
        onClick={() => setOuvert((valeur) => !valeur)}
      >
        <ChevronDown className={classes.chevron} data-ouvert={ouvert} aria-hidden="true" />
        <span className="clair-chiffres">
          {nombre} vote{nombre > 1 ? "s" : ""}
        </span>
        <span className="clair-visually-hidden"> de l'étape du {date}</span>
      </button>
      <ul id={id} hidden={!ouvert} className={classes.votes}>
        {scrutins.map((scrutin) => {
          const statut = parseStatut(scrutin.sort);
          return (
            <li key={scrutin.id} className={classes.vote}>
              {statut ? (
                <StatutBadge statut={statut} size="sm" />
              ) : (
                <Badge size="sm">{scrutin.sort}</Badge>
              )}
              <Link href={scrutinHref(scrutin)}>
                Scrutin n° {scrutin.numero} : {scrutin.titre}
              </Link>
              <span className="clair-chiffres">
                {scrutin.nombrePour} pour, {scrutin.nombreContre} contre
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
};
