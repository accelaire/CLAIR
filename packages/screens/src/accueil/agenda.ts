import type { AgendaEvenement, HomepageReunion } from "@clair/data";
import { isHappeningNow } from "@clair/ui";
import { joursCouverts } from "../agenda/evenements.ts";
import { jourParis } from "../agenda/params.ts";

/**
 * Planning « Prochainement au Parlement » de l'accueil (reprise de `UpcomingTimeline` et
 * `DayCard` de apps/web/app/page.tsx). Les jours se lisent à l'heure de Paris : le serveur et
 * le navigateur rangent alors une réunion dans le même jour.
 */

/** Réunions affichées d'office par jour ; les suivantes restent sur l'agenda. */
export const REUNIONS_PAR_JOUR = 3;

export type JourDuPlanning = {
  /** `YYYY-MM-DD`, heure de Paris. */
  jour: string;
  /** « Mardi 3 mars ». */
  titre: string;
  reunions: HomepageReunion[];
  evenements: AgendaEvenement[];
};

const formatJour = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

const formatHeure = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

/** « Mardi 3 mars » pour `2026-03-03`. */
export const titreDuJour = (jour: string) => {
  const texte = formatJour.format(new Date(`${jour}T12:00:00Z`));
  return texte.charAt(0).toUpperCase() + texte.slice(1);
};

/** « 15:00 », heure de Paris. */
export const heureDe = (iso: string) => formatHeure.format(new Date(iso));

/**
 * Réunions regroupées par jour, dans l'ordre reçu (chronologique), chaque jour accompagné des
 * repères institutionnels qui le couvrent.
 */
export const joursDuPlanning = (
  reunions: HomepageReunion[],
  evenements: AgendaEvenement[],
): JourDuPlanning[] => {
  const jours = new Map<string, HomepageReunion[]>();
  for (const reunion of reunions) {
    const jour = jourParis(new Date(reunion.dateDebut));
    const liste = jours.get(jour);
    if (liste) liste.push(reunion);
    else jours.set(jour, [reunion]);
  }
  return [...jours].map(([jour, reunionsDuJour]) => ({
    jour,
    titre: titreDuJour(jour),
    reunions: reunionsDuJour,
    evenements: evenements.filter((evenement) => joursCouverts(evenement).includes(jour)),
  }));
};

/** La réunion a-t-elle lieu à cet instant ? Inconnu (`false`) tant que l'heure n'est pas lue. */
export const reunionEnCours = (reunion: HomepageReunion, maintenant: Date | null) =>
  maintenant !== null && isHappeningNow(reunion.dateDebut, reunion.dateFin, maintenant);

/**
 * Réunions montrées pour un jour : les trois premières, plus celles en cours (comme apps/web,
 * une réunion en cours n'est jamais cachée). Renvoie aussi le nombre de réunions restantes.
 */
export const reunionsVisibles = (reunions: HomepageReunion[], maintenant: Date | null) => {
  const visibles = reunions.filter(
    (reunion, index) => index < REUNIONS_PAR_JOUR || reunionEnCours(reunion, maintenant),
  );
  return { visibles, restantes: reunions.length - visibles.length };
};

/**
 * Chambre d'une réunion : celle de sa commission, sinon celle que trahit la référence du compte
 * rendu d'une séance (`CRSA…` Assemblée, `CRSS…` Sénat) ou son lieu (`deriveChambre` de apps/web).
 */
export const chambreDeReunion = (reunion: HomepageReunion): "assemblee" | "senat" | null => {
  const chambre = reunion.commission?.chambre;
  if (chambre === "assemblee" || chambre === "senat") return chambre;
  if (reunion.compteRenduRef?.startsWith("CRSA")) return "assemblee";
  if (reunion.compteRenduRef?.startsWith("CRSS")) return "senat";
  if (reunion.lieu?.includes("Palais Bourbon") || reunion.lieu?.includes("Assemblée nationale"))
    return "assemblee";
  if (reunion.lieu?.includes("Palais du Luxembourg") || reunion.lieu?.includes("Sénat"))
    return "senat";
  return null;
};
