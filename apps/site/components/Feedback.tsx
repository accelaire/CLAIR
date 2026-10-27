"use client";

import { FeedbackWidget, type RetourVisiteur } from "@clair/screens";

/**
 * Envoi d'un retour par le proxy same-origin : `POST /api/v1/feedback` est le seul chemin
 * d'écriture qu'il relaie (avec le secret interne et l'IP du visiteur pour la limite de débit).
 */
const envoyer = async (retour: RetourVisiteur) => {
  const reponse = await fetch("/api/v1/feedback", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(retour),
  });
  if (!reponse.ok) throw new Error(`Retour refusé : ${reponse.status}`);
};

/** Bouton « Donner mon avis » du site, branché sur l'API. */
export const Feedback = () => <FeedbackWidget envoyer={envoyer} />;
