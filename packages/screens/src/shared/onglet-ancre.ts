"use client";

import { useNavigation } from "@clair/ui";
import { type RefObject, useEffect, useRef } from "react";

/**
 * Onglet désigné par l'ancre d'une adresse (`#interventions`), ou `null` si l'ancre ne nomme
 * aucun des onglets donnés.
 */
export const ongletDeLAncre = <T extends string>(hash: string, onglets: readonly T[]): T | null => {
  let ancre = hash.startsWith("#") ? hash.slice(1) : hash;
  try {
    ancre = decodeURIComponent(ancre);
  } catch {
    return null;
  }
  return onglets.find((onglet) => onglet === ancre) ?? null;
};

const mouvementReduit = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Anciens liens à ancre. apps/web portait l'onglet ouvert dans l'ancre (`/scrutins/42#vote`,
 * `useOngletAncre`, master a14e21f) ; le nouveau front le porte dans un paramètre (`?onglet=`,
 * `?tab=`). Une ancre qui nomme un onglet, à l'arrivée ou pendant la visite, est traduite en
 * paramètre (`hrefOf`), sans nouvelle entrée d'historique, et la barre d'onglets est amenée à
 * l'écran, comme dans apps/web. Une autre ancre est laissée au navigateur.
 *
 * `onglets` : les clés reconnues (les anciennes ancres) ; un onglet que la page n'affiche pas
 * retombe sur l'onglet par défaut, comme un `?onglet=` inconnu. Renvoie la référence à poser
 * sur le bloc des onglets.
 */
export const useOngletAncre = <T extends string>(
  onglets: readonly T[],
  hrefOf: (onglet: T) => string,
): RefObject<HTMLElement | null> => {
  const { navigate, replace } = useNavigation();
  const barre = useRef<HTMLElement | null>(null);
  const aDefiler = useRef(false);
  const luAuMontage = useRef(false);
  const dernier = useRef({ onglets, hrefOf, aller: replace ?? navigate });
  dernier.current = { onglets, hrefOf, aller: replace ?? navigate };

  // Au montage, puis à chaque changement d'ancre ; les valeurs à jour viennent de `dernier`.
  useEffect(() => {
    const lire = () => {
      const onglet = ongletDeLAncre(window.location.hash, dernier.current.onglets);
      if (!onglet) return;
      aDefiler.current = true;
      dernier.current.aller(dernier.current.hrefOf(onglet));
    };
    // Une seule lecture au montage, même si l'effet est rejoué (mode strict de React).
    if (!luAuMontage.current) {
      luAuMontage.current = true;
      lire();
    }
    window.addEventListener("hashchange", lire);
    return () => window.removeEventListener("hashchange", lire);
  }, []);

  // Défile dès que la barre existe (la fiche peut finir de charger après la lecture de l'ancre).
  useEffect(() => {
    const element = barre.current;
    if (!aDefiler.current || !element) return;
    aDefiler.current = false;
    if (typeof element.scrollIntoView === "function") {
      element.scrollIntoView({ behavior: mouvementReduit() ? "auto" : "smooth", block: "start" });
    }
  });

  return barre;
};
