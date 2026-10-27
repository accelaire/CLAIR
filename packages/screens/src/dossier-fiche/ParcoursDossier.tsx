"use client";

import type { EtapeParcoursDossier } from "@clair/data";
import {
  EmptyState,
  type LegislativeStep,
  LegislativeTimeline,
  Link,
  parseStatut,
  StatutBadge,
} from "@clair/ui";
import { scrutinHref } from "../shared/scrutins.ts";
import classes from "./DossierFicheScreen.module.css";

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

const libelleEtape = (etape: EtapeParcoursDossier) =>
  etape.commission?.nom ??
  (etape.type === "commission" ? "Réunion de commission" : "Séance publique");

/** « 12 prises de parole · 3 avis · 2 votes ». */
const volumeEtape = (etape: EtapeParcoursDossier) =>
  [
    etape.nbPrises ? `${etape.nbPrises} prise${etape.nbPrises > 1 ? "s" : ""} de parole` : null,
    etape.nbAvis ? `${etape.nbAvis} avis sur amendements` : null,
    etape.scrutins.length > 0
      ? `${etape.scrutins.length} vote${etape.scrutins.length > 1 ? "s" : ""}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ") || null;

/** Une étape du parcours devient une étape franchie de la frise. */
export const etapeDeFrise = (etape: EtapeParcoursDossier): LegislativeStep => ({
  code: etape.uid,
  label: libelleEtape(etape),
  chambre: etape.chambre,
  status: "done",
  date: etape.date,
  detail: volumeEtape(etape),
});

/**
 * Parcours du texte : les réunions de commission et les séances publiques où il a été examiné,
 * dans l'ordre, en frise. Sous la frise, chaque étape mène à son débat complet (quand la page
 * existe) et à ses votes.
 */
export const ParcoursDossier = ({ etapes }: { etapes: EtapeParcoursDossier[] }) => {
  if (etapes.length === 0) {
    return (
      <EmptyState
        title="Aucune étape connue"
        description="Aucune réunion ni séance n'est rattachée à ce texte pour l'instant."
      />
    );
  }
  const detaillees = etapes.filter((etape) => etape.consultable || etape.scrutins.length > 0);
  return (
    <LegislativeTimeline
      steps={etapes.map(etapeDeFrise)}
      title="Parcours du texte"
      headingLevel={3}
    >
      <p className={classes.mention}>
        Les réunions de commission et les séances publiques où ce texte a été examiné, dans l'ordre.
      </p>
      {detaillees.length > 0 ? (
        <ol className={classes.etapes} aria-label="Débats et votes de chaque étape">
          {detaillees.map((etape) => (
            <li key={etape.uid} className={classes.etape}>
              <p className={classes.etapeTitre}>
                <time dateTime={etape.date}>{dateFormat.format(new Date(etape.date))}</time> ·{" "}
                {etape.consultable ? (
                  <Link href={`/reunions/${encodeURIComponent(etape.uid)}`}>
                    {libelleEtape(etape)}
                  </Link>
                ) : (
                  libelleEtape(etape)
                )}
              </p>
              {etape.scrutins.length > 0 ? (
                <ul className={classes.votesEtape}>
                  {etape.scrutins.map((scrutin) => {
                    const statut = parseStatut(scrutin.sort);
                    return (
                      <li key={scrutin.id} className={classes.voteEtape}>
                        {statut ? <StatutBadge statut={statut} size="sm" /> : null}
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
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </LegislativeTimeline>
  );
};
