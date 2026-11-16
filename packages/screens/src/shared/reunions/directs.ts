"use client";

import { useApiQuery } from "@clair/api-client";
import type { Chambre, DirectsDuJour } from "@clair/data";
import { useEffect, useState } from "react";

/** Relecture des directs : toutes les cinq minutes, comme `useLiveNow` de apps/web. */
const RELECTURE_MS = 5 * 60 * 1000;

/** Ce qu'il faut d'une réunion pour la rapprocher d'un direct. */
export type ReunionRapprochable = {
  type: string;
  dateDebut: string;
  compteRenduRef?: string | null;
  commission?: { organeRef?: string | null } | null;
};

/**
 * Lien du direct d'une réunion, ou `undefined` (reprise de `matchLiveUrl` de apps/web) : par
 * l'organe réuni, puis par le rang de la séance tiré du compte rendu (`…N<rang>`), puis, pour une
 * séance, par la date. `chambre` : celle de la réunion, déduite par l'écran.
 */
export const lienDuDirect = (
  reunion: ReunionRapprochable,
  chambre: Chambre | null,
  directs: DirectsDuJour | undefined,
): string | undefined => {
  if (!directs) return undefined;
  const organeRef = reunion.commission?.organeRef;
  if (organeRef) {
    const commission = directs.commissions.find((direct) => direct.organeRef === organeRef);
    if (commission) return commission.directUrl;
  }
  if (!chambre) return undefined;
  const debut = new Date(reunion.dateDebut);
  if (Number.isNaN(debut.getTime())) return undefined;
  // Jour UTC, comme le calcule la route des directs.
  const jour = debut.toISOString().slice(0, 10);
  const seancesDuJour = directs.seances.filter(
    (seance) => seance.chambre === chambre && seance.isoDate === jour,
  );
  const rang = reunion.compteRenduRef?.match(/N(\d+)$/)?.[1];
  if (rang) {
    const seance = seancesDuJour.find((direct) => direct.order === Number.parseInt(rang, 10));
    if (seance) return seance.directUrl;
  }
  return reunion.type === "seance" ? seancesDuJour[0]?.directUrl : undefined;
};

/**
 * Directs du jour (route `/agenda/direct` du site), relus toutes les cinq minutes. `actif` :
 * seulement quand une réunion affichée est en cours, pour ne rien demander le reste du temps.
 */
export const useDirects = (actif: boolean) =>
  useApiQuery<DirectsDuJour>(
    "/agenda/direct",
    {},
    { enabled: actif, refetchInterval: RELECTURE_MS },
  ).data;

/**
 * Heure courante, lue après l'hydratation puis chaque minute (`null` au premier rendu) : une page
 * rendue côté serveur et mise en cache ne peut pas savoir quelle réunion est en cours au moment de
 * la visite, et le serveur et le navigateur rendent ainsi la même chose.
 */
export const useHeureCourante = () => {
  const [maintenant, setMaintenant] = useState<Date | null>(null);
  useEffect(() => {
    setMaintenant(new Date());
    const minuteur = setInterval(() => setMaintenant(new Date()), 60_000);
    return () => clearInterval(minuteur);
  }, []);
  return maintenant;
};
