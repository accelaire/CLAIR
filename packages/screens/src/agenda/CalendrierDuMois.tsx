"use client";

import type { AgendaEvenement } from "@clair/data";
import { type CalendrierJour, CalendrierMois } from "@clair/ui";
import classes from "./AgendaScreen.module.css";
import { jourDe, joursCouverts, libelleDateEvenement } from "./evenements.ts";

const nomDuJour = (jour: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${jour}T12:00:00Z`));

/** Densité des réunions d'un jour : la taille du point la montre, le libellé la dit. */
const densite = (nombre: number) =>
  nombre === 0 ? null : nombre === 1 ? "faible" : nombre <= 4 ? "moyenne" : "forte";

export type CalendrierDuMoisProps = {
  /** Mois affiché, `YYYY-MM`. */
  mois: string;
  /** Nombre de réunions par jour `YYYY-MM-DD`. */
  reunionsParJour: Record<string, number>;
  evenements: AgendaEvenement[];
  /** Jour choisi, `YYYY-MM-DD`, ou vide. */
  selection: string;
  aujourdhui: string;
  onSelect: (jour: string) => void;
  onMois: (ecart: number) => void;
};

/**
 * Calendrier d'un mois (`CalendrierMois`, sur `@mantine/dates`) : chaque jour est un bouton dont
 * le libellé dit le nombre de réunions et les événements. Les périodes (suspension, session) sont
 * listées sous la grille. Remplace `MonthCalendar` de apps/web.
 */
export const CalendrierDuMois = ({
  mois,
  reunionsParJour,
  evenements,
  selection,
  aujourdhui,
  onSelect,
  onMois,
}: CalendrierDuMoisProps) => {
  const ponctuels = evenements.filter((e) => !e.dateFin);
  const periodes = evenements.filter((e) => e.dateFin);
  const evenementsDuJour = (cle: string) => ponctuels.filter((e) => jourDe(e.dateDebut) === cle);
  const enPeriode = new Set(periodes.flatMap((e) => joursCouverts(e)));
  const aDesPonctuels = ponctuels.length > 0;

  const getJour = (cle: string): CalendrierJour => {
    const nombre = reunionsParJour[cle] ?? 0;
    const duJour = evenementsDuJour(cle);
    return {
      label: [
        nomDuJour(cle),
        nombre > 0 ? `${nombre} réunion${nombre > 1 ? "s" : ""}` : "aucune réunion",
        ...duJour.map((e) => e.titre),
      ].join(", "),
      periode: enPeriode.has(cle),
      marques: (
        <>
          {nombre > 0 ? <span className={classes.point} data-densite={densite(nombre)} /> : null}
          {duJour.map((e) => (
            <span key={e.id} className={classes.carre} />
          ))}
        </>
      ),
    };
  };

  /** Écart en mois entre deux `YYYY-MM`. */
  const ecart = (suivant: string) => {
    const [a1 = 0, m1 = 0] = mois.split("-").map(Number);
    const [a2 = 0, m2 = 0] = suivant.split("-").map(Number);
    return (a2 - a1) * 12 + (m2 - m1);
  };

  return (
    <div className={classes.calendrier}>
      <CalendrierMois
        mois={mois}
        onMoisChange={(suivant) => onMois(ecart(suivant))}
        selection={selection || null}
        aujourdhui={aujourdhui}
        onSelect={onSelect}
        getJour={getJour}
      />

      {periodes.length > 0 ? (
        <ul className={classes.periodes} aria-label="Périodes en cours ce mois-ci">
          {periodes.map((periode) => (
            <li key={periode.id} className={classes.periode}>
              <span className={classes.periodeTitre}>{periode.titre}</span>
              <span className={classes.periodeDate}>{libelleDateEvenement(periode)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <ul className={classes.legende} aria-label="Légende du calendrier">
        <li>
          <span className={classes.point} data-densite="faible" aria-hidden="true" /> 1 réunion
        </li>
        <li>
          <span className={classes.point} data-densite="moyenne" aria-hidden="true" /> 2 à 4
        </li>
        <li>
          <span className={classes.point} data-densite="forte" aria-hidden="true" /> 5 ou plus
        </li>
        {aDesPonctuels ? (
          <li>
            <span className={classes.carre} aria-hidden="true" /> Événement institutionnel
          </li>
        ) : null}
        {periodes.length > 0 ? (
          <li>
            <span className={classes.trait} aria-hidden="true" /> Jour d'une période
          </li>
        ) : null}
      </ul>
    </div>
  );
};
