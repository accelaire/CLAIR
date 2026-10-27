"use client";

import { useApiQuery } from "@clair/api-client";
import type { SujetDetail, SujetDossier, SujetEtapeParcours } from "@clair/data";
import {
  Badge,
  ChambreBadge,
  LegislativeTimeline,
  Link,
  parseStatut,
  StatutBadge,
} from "@clair/ui";
import { ChevronDown, Landmark, Users } from "lucide-react";
import { useId, useState } from "react";
import { scrutinHref } from "../shared/scrutins.ts";
import { compte, formatDate } from "../sujets-liste/format.ts";
import { etapesDuSujet } from "./parcours.ts";
import classes from "./SujetFicheScreen.module.css";

/** Une séance ou réunion : date, chambre, volume, objet et votes. */
const Etape = ({ etape }: { etape: SujetEtapeParcours }) => {
  const nom =
    etape.commission?.nom ??
    (etape.type === "commission" ? "Réunion de commission" : "Séance publique");
  const Icone = etape.type === "commission" ? Users : Landmark;
  return (
    <li className={classes.etape}>
      <p className={classes.etapeMeta}>
        <Icone className={classes.icon} aria-hidden="true" />
        <time dateTime={etape.date}>{formatDate(etape.date)}</time>
        {etape.chambre ? <ChambreBadge chambre={etape.chambre} short size="sm" /> : null}
        {etape.nbPrises ? <span>{compte(etape.nbPrises, "prise")} de parole</span> : null}
        {etape.nbAvis ? <span>{etape.nbAvis} avis</span> : null}
      </p>
      <p className={classes.etapeNom}>
        {etape.consultable === true ? (
          <Link href={`/reunions/${encodeURIComponent(etape.uid)}`}>{nom}</Link>
        ) : (
          nom
        )}
      </p>
      {etape.textes && etape.textes.length > 0 ? (
        <p className={classes.mention}>{etape.textes.map((t) => t.titre).join(" · ")}</p>
      ) : null}
      {etape.scrutins.length > 0 ? (
        <ul
          className={classes.votes}
          aria-label={`Votes de cette étape (${etape.scrutins.length})`}
        >
          {etape.scrutins.map((scrutin) => {
            const statut = parseStatut(scrutin.sort);
            return (
              <li key={scrutin.id} className={classes.vote}>
                {statut ? (
                  <StatutBadge statut={statut} size="sm" />
                ) : (
                  <Badge size="sm">{scrutin.sort}</Badge>
                )}
                <Link href={scrutinHref(scrutin)}>{scrutin.titre}</Link>
                <span className="clair-chiffres">
                  {scrutin.nombrePour} pour, {scrutin.nombreContre} contre
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
};

/**
 * Séances et réunions où les textes du sujet ont été examinés, repliées par défaut (un sujet en
 * compte jusqu'à soixante). Chargées à part : la page se lit sans elles.
 */
const SeancesDuSujet = ({ slug }: { slug: string }) => {
  const [ouvert, setOuvert] = useState(false);
  const id = useId();
  const { data } = useApiQuery<{ data: SujetEtapeParcours[] }>(
    `/sujets/${encodeURIComponent(slug)}/chronologie`,
  );
  const etapes = data?.data ?? [];
  if (etapes.length === 0) return null;
  const seances = etapes.filter((e) => e.type === "seance").length;
  const commissions = etapes.length - seances;
  const resume = [
    seances > 0
      ? `${seances} séance${seances > 1 ? "s" : ""} publique${seances > 1 ? "s" : ""}`
      : null,
    commissions > 0 ? `${compte(commissions, "réunion")} de commission` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={classes.seances}>
      <button
        type="button"
        className={classes.toggle}
        aria-expanded={ouvert}
        aria-controls={id}
        onClick={() => setOuvert((v) => !v)}
      >
        <ChevronDown className={classes.chevron} data-ouvert={ouvert} aria-hidden="true" />
        Séances et réunions
        <span className={classes.mention}>{resume}</span>
      </button>
      <div id={id} hidden={!ouvert}>
        <p className={classes.mention}>
          Où les textes de ce sujet ont été examinés, dans l'ordre : chaque étape mène à son débat
          complet.
        </p>
        <ol className={classes.etapes}>
          {etapes.map((etape) => (
            <Etape key={etape.uid} etape={etape} />
          ))}
        </ol>
      </div>
    </div>
  );
};

/** Parcours parlementaire : frise des étapes, puis les séances qui s'y sont tenues. */
export const ParcoursSujet = ({
  slug,
  sujet,
  dossiers,
}: {
  slug: string;
  sujet: SujetDetail;
  dossiers: SujetDossier[];
}) =>
  dossiers.length === 0 ? null : (
    <div className={classes.block}>
      <LegislativeTimeline steps={etapesDuSujet(dossiers, sujet)}>
        <SeancesDuSujet slug={slug} />
      </LegislativeTimeline>
    </div>
  );
