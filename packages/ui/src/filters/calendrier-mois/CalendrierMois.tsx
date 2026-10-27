"use client";

import "dayjs/locale/fr";
import { Calendar, type CalendarAriaLabels } from "@mantine/dates";
import type { KeyboardEvent, ReactNode } from "react";
import classes from "./CalendrierMois.module.css";

/** Ce qu'un écran dit d'un jour : son libellé complet, ses marques et s'il est dans une période. */
export type CalendrierJour = {
  /**
   * Nom accessible complet du jour (« mardi 14 octobre, 3 réunions, Conférence des présidents ») :
   * il doit dire tout ce que montrent les marques. Par défaut : le jour en toutes lettres.
   */
  label?: string;
  /** Marques visuelles sous le numéro (points, carrés), masquées aux lecteurs d'écran. */
  marques?: ReactNode;
  /** Jour compris dans une période (session, suspension) : souligné d'un trait. */
  periode?: boolean;
};

export type CalendrierMoisProps = {
  /** Mois affiché, `YYYY-MM` (contrôlé : l'écran le lit et l'écrit dans l'URL). */
  mois: string;
  /** Appelé avec le nouveau mois (`YYYY-MM`) quand la personne change de mois. */
  onMoisChange: (mois: string) => void;
  /** Jour choisi, `YYYY-MM-DD`, ou `null`. */
  selection?: string | null;
  /** Appelé avec le jour choisi, `YYYY-MM-DD`. */
  onSelect: (jour: string) => void;
  /**
   * Jour d'aujourd'hui, `YYYY-MM-DD`, calculé par l'écran dans le bon fuseau (Paris) : la date
   * du navigateur peut différer de celle du serveur autour de minuit.
   */
  aujourdhui?: string;
  /** Libellé, marques et période de chaque jour du mois. */
  getJour?: (jour: string) => CalendrierJour;
  /** Niveau du titre du mois, lu par les lecteurs d'écran (l'en-tête le montre déjà). */
  headingLevel?: 2 | 3 | 4;
};

const ariaLabels: CalendarAriaLabels = {
  monthLevelControl: "Choisir le mois",
  yearLevelControl: "Choisir l'année",
  nextMonth: "Mois suivant",
  previousMonth: "Mois précédent",
  nextYear: "Année suivante",
  previousYear: "Année précédente",
  nextDecade: "Décennie suivante",
  previousDecade: "Décennie précédente",
};

const jourEnLettres = (jour: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${jour}T12:00:00Z`));

/** Mois voisin, `YYYY-MM`. */
const moisVoisin = (mois: string, ecart: number) => {
  const [annee = 1970, numero = 1] = mois.split("-").map(Number);
  const date = new Date(Date.UTC(annee, numero - 1 + ecart, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

/**
 * Touches que Mantine ne gère pas : Début / Fin vont au premier / dernier jour de la semaine,
 * Page précédente / suivante changent de mois (motif « date picker » de l'APG).
 */
const auClavier = (
  event: KeyboardEvent<HTMLButtonElement>,
  mois: string,
  onMoisChange: (mois: string) => void,
) => {
  if (event.key === "PageUp" || event.key === "PageDown") {
    event.preventDefault();
    onMoisChange(moisVoisin(mois, event.key === "PageUp" ? -1 : 1));
    return;
  }
  if (event.key !== "Home" && event.key !== "End") return;
  const semaine = [
    ...(event.currentTarget
      .closest("tr")
      ?.querySelectorAll<HTMLButtonElement>("button:not([data-hidden])") ?? []),
  ];
  const cible = event.key === "Home" ? semaine[0] : semaine.at(-1);
  if (!cible) return;
  event.preventDefault();
  cible.focus();
};

const nomDuMois = (mois: string) =>
  new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${mois}-15T12:00:00Z`),
  );

/**
 * Calendrier d'un mois (`Calendar` de `@mantine/dates`, en français, semaine du lundi) où chaque
 * jour est un bouton : son nom accessible dit tout ce que montrent ses marques. Clavier de Mantine
 * (flèches, y compris d'un mois à l'autre ; Entrée ou Espace pour choisir), plus Début / Fin et
 * Page précédente / suivante. Le titre du mois est annoncé quand il change. Les jours hors du mois sont masqués. Remplace la grille de `MonthCalendar` de apps/web.
 */
export const CalendrierMois = ({
  mois,
  onMoisChange,
  selection = null,
  onSelect,
  aujourdhui,
  getJour,
  headingLevel = 2,
}: CalendrierMoisProps) => {
  // Mantine signale aussi le mois du jour cliqué : seul un vrai changement est transmis.
  const changerDeMois = (date: string) => {
    if (date.slice(0, 7) !== mois) onMoisChange(date.slice(0, 7));
  };
  const Titre = `h${headingLevel}` as const;
  return (
    <div className={classes.root}>
      {/* L'en-tête de Mantine montre déjà le mois : le titre structure la page et annonce le changement. */}
      <Titre className="clair-visually-hidden" aria-live="polite">
        {nomDuMois(mois)}
      </Titre>
      <Calendar
        locale="fr"
        firstDayOfWeek={1}
        date={`${mois}-01`}
        onDateChange={changerDeMois}
        maxLevel="month"
        hideOutsideDates
        highlightToday={false}
        fullWidth
        ariaLabels={ariaLabels}
        getDayAriaLabel={(jour) => getJour?.(jour).label ?? jourEnLettres(jour)}
        getDayProps={(jour) => ({
          selected: jour === selection,
          "aria-pressed": jour === selection,
          "aria-current": jour === aujourdhui ? "date" : undefined,
          "data-periode": getJour?.(jour).periode || undefined,
          onClick: () => onSelect(jour),
          onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) =>
            auClavier(event, mois, onMoisChange),
        })}
        renderDay={(jour) => (
          <span className={classes.contenu}>
            <span className={classes.numero}>{Number(jour.slice(8))}</span>
            <span className={classes.marques} aria-hidden="true">
              {getJour?.(jour).marques}
            </span>
          </span>
        )}
        classNames={{
          calendarHeader: classes.entete,
          calendarHeaderLevel: classes.niveau,
          calendarHeaderControl: classes.controle,
          weekday: classes.jourSemaine,
          day: classes.jour,
        }}
      />
    </div>
  );
};
