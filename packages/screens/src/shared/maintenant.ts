"use client";

import { useEffect, useState } from "react";

/**
 * Instant de référence d'un écran (ms). Le premier rendu prend `initial`, l'instant du rendu
 * serveur passé par la route : serveur et navigateur affichent la même chose, sans écart
 * d'hydratation. Une fois la page montée, l'instant du navigateur le remplace, pour qu'une page mise
 * en cache (ISR) ne garde pas l'état d'il y a une heure (réunion « à venir » déjà passée…).
 */
export const useMaintenant = (initial?: number) => {
  const [maintenant, setMaintenant] = useState(() => initial ?? Date.now());
  useEffect(() => {
    setMaintenant(Date.now());
  }, []);
  return maintenant;
};
