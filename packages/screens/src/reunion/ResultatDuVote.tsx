import type { ScrutinDeSeance } from "@clair/data";
import { Badge, Link, parseStatut, StatutBadge } from "@clair/ui";
import { scrutinHref } from "../shared/scrutins.ts";
import classes from "./ReunionScreen.module.css";

/**
 * Résultat d'un vote posé dans le fil du débat : verdict écrit et les trois décomptes (« adopté
 * par 84 voix contre 79 » ne raconte pas la même séance que « 400 contre 12 »).
 */
export const ResultatDuVote = ({
  scrutin,
  suivi = false,
}: {
  scrutin: ScrutinDeSeance;
  /** Le vote d'où l'on arrive. */
  suivi?: boolean;
}) => {
  const statut = parseStatut(scrutin.sort);
  return (
    <div className={classes.vote} data-suivi={suivi || undefined}>
      <p className={classes.voteEntete}>
        <Link href={scrutinHref(scrutin)} aria-current={suivi ? "true" : undefined}>
          Scrutin n° {scrutin.numero}
        </Link>
        {statut ? <StatutBadge statut={statut} size="sm" /> : null}
        {suivi ? (
          <Badge size="sm" tone="info">
            Le vote que vous consultiez
          </Badge>
        ) : null}
        <span className={`${classes.mention} clair-chiffres`}>
          {scrutin.nombrePour.toLocaleString("fr-FR")} pour ·{" "}
          {scrutin.nombreContre.toLocaleString("fr-FR")} contre ·{" "}
          {scrutin.nombreAbstention.toLocaleString("fr-FR")} abstention
          {scrutin.nombreAbstention > 1 ? "s" : ""}
        </span>
      </p>
      <p className={classes.voteTitre}>{scrutin.titre}</p>
    </div>
  );
};
