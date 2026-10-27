import type { AgendaEvenement, AgendaReunion } from "@clair/data";

/**
 * Lecture des repères institutionnels de l'agenda (reprise de `EvenementCard.tsx` de apps/web).
 * Les dates d'événement sont stockées à minuit UTC : le jour se lit dans la chaîne, sans
 * conversion de fuseau.
 */

/** Jour `YYYY-MM-DD` d'un instant ISO, tranché dans la chaîne. */
export const jourDe = (iso: string) => iso.slice(0, 10);

/** Tous les jours couverts par un événement, bornes incluses. */
export const joursCouverts = (evenement: Pick<AgendaEvenement, "dateDebut" | "dateFin">) => {
  const debut = jourDe(evenement.dateDebut);
  if (!evenement.dateFin) return [debut];
  const fin = jourDe(evenement.dateFin);
  const jours: string[] = [];
  const curseur = new Date(`${debut}T12:00:00Z`);
  const borne = new Date(`${fin}T12:00:00Z`);
  while (curseur <= borne) {
    jours.push(curseur.toISOString().slice(0, 10));
    curseur.setUTCDate(curseur.getUTCDate() + 1);
  }
  return jours;
};

const formatJour = (jour: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${jour}T12:00:00Z`));

const formatMois = (jour: string) =>
  new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${jour}T12:00:00Z`),
  );

/**
 * Libellé de date d'un événement. Une échéance dont la date n'est pas fixée n'affiche que son
 * mois : présenter le jour stocké reviendrait à inventer une information.
 */
export const libelleDateEvenement = (evenement: AgendaEvenement) => {
  if (!evenement.datePrecise) return `Courant ${formatMois(jourDe(evenement.dateDebut))}`;
  if (!evenement.dateFin) return formatJour(jourDe(evenement.dateDebut));
  return `Du ${formatJour(jourDe(evenement.dateDebut))} au ${formatJour(jourDe(evenement.dateFin))}`;
};

/**
 * Événements auxquels le site consacre une page (indexés par slug : seule une page réellement
 * instruite mérite d'envoyer le lecteur ailleurs).
 */
const RESULTATS_SENATORIALES = {
  href: "/senatoriales-2026#resultats",
  label: "Les résultats des sénatoriales",
};
const PAGES_DEDIEES: Record<string, { href: string; label: string }> = {
  "senatoriales-2026": {
    href: "/senatoriales-2026#resultats",
    label: "Les résultats et les élus de chaque circonscription",
  },
  "prise-fonction-senateurs-2026": RESULTATS_SENATORIALES,
  "election-president-senat-2026": RESULTATS_SENATORIALES,
  "constitution-groupes-senat-2026": RESULTATS_SENATORIALES,
  "bureau-senat-2026": RESULTATS_SENATORIALES,
  "renouvellement-commissions-senat-2026": RESULTATS_SENATORIALES,
};

export const pageDedieePour = (slug: string) => PAGES_DEDIEES[slug] ?? null;

/**
 * Chambre d'une réunion : celle de sa commission, sinon celle que trahit la référence du compte
 * rendu d'une séance (`CRSA…` Assemblée, `CRSS…` Sénat).
 */
export const chambreDeReunion = (reunion: AgendaReunion): "assemblee" | "senat" | null => {
  const chambre = reunion.commission?.chambre;
  if (chambre === "assemblee" || chambre === "senat") return chambre;
  if (reunion.compteRenduRef?.startsWith("CRSA")) return "assemblee";
  if (reunion.compteRenduRef?.startsWith("CRSS")) return "senat";
  if (reunion.urlVideo?.includes("assemblee-nationale.fr")) return "assemblee";
  if (reunion.urlVideo?.includes("senat.fr")) return "senat";
  if (reunion.lieu?.includes("Palais Bourbon") || reunion.lieu?.includes("Assemblée nationale"))
    return "assemblee";
  if (reunion.lieu?.includes("Palais du Luxembourg") || reunion.lieu?.includes("Sénat"))
    return "senat";
  return null;
};
