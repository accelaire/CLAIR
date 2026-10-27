"use client";

import { useApiQuery } from "@clair/api-client";
import type { InterventionComplete, PriseDeParoleReunion } from "@clair/data";
import { Button, Link } from "@clair/ui";
import { useId, useState } from "react";
import { lienSur } from "../shared/reunions/reunions.ts";
import { parlementaireHref } from "../shared/scrutins.ts";
import { ancreDuRang } from "./params.ts";
import classes from "./ReunionScreen.module.css";

const nomDe = (prise: PriseDeParoleReunion) =>
  prise.parlementaire
    ? `${prise.parlementaire.prenom} ${prise.parlementaire.nom}`
    : [prise.orateurPrenom, prise.orateurNom].filter(Boolean).join(" ") || "Orateur non identifié";

/**
 * Une prise de parole : orateur (lien vers sa fiche quand il est identifié), groupe, qualité et
 * texte. Un texte tronqué par l'API se déplie en chargeant sa suite (`aria-expanded`).
 */
export const PriseDeParole = ({ prise }: { prise: PriseDeParoleReunion }) => {
  const [deplie, setDeplie] = useState(false);
  const id = useId();
  const suite = useApiQuery<InterventionComplete>(
    `/scrutins/interventions/${encodeURIComponent(prise.id)}`,
    {},
    { enabled: deplie && prise.hasMore },
  );
  const groupe = prise.parlementaire?.groupe?.nom ?? prise.orateurGroupe;
  const source = lienSur(prise.sourceUrl);
  const texte = deplie && suite.data ? suite.data.data.contenu : prise.contenu;
  return (
    <article
      className={classes.prise}
      id={prise.ordre !== null ? ancreDuRang(prise.ordre) : undefined}
      aria-label={`Prise de parole de ${nomDe(prise)}`}
    >
      <p className={classes.orateur}>
        {prise.parlementaire ? (
          <Link
            href={parlementaireHref(prise.parlementaire.chambre, prise.parlementaire.slug)}
            className={classes.nomOrateur}
          >
            {nomDe(prise)}
          </Link>
        ) : (
          <span className={classes.nomOrateur}>{nomDe(prise)}</span>
        )}
        {groupe ? <span className={classes.mention}>{groupe}</span> : null}
        {prise.orateurQualite ? (
          <span className={classes.qualite}>{prise.orateurQualite}</span>
        ) : null}
      </p>
      <div id={id} className={classes.texte}>
        {texte}
        {prise.hasMore && !(deplie && suite.data) ? "…" : null}
      </div>
      {prise.hasMore || source ? (
        <p className={classes.actionsPrise}>
          {prise.hasMore ? (
            <Button
              variant="tertiaire"
              size="sm"
              aria-expanded={deplie && Boolean(suite.data)}
              aria-controls={id}
              loading={deplie && suite.isFetching}
              onClick={() => setDeplie((etat) => !etat)}
            >
              {deplie && suite.data ? "Réduire" : "Lire la suite"}
            </Button>
          ) : null}
          {deplie && suite.isError ? (
            <span className={classes.mention}>La suite n'a pas pu être chargée.</span>
          ) : null}
          {source ? (
            <Link href={source} external>
              Compte rendu officiel
            </Link>
          ) : null}
        </p>
      ) : null}
    </article>
  );
};
