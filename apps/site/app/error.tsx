"use client";

import { ErrorScreen } from "@clair/screens";
import { useEffect } from "react";

type Props = { error: Error & { digest?: string }; retry: () => void };

/**
 * Erreur de rendu d'une page : message et nouvelle tentative (`retry` recharge aussi les données
 * du serveur). L'erreur est journalisée avec son `digest`, l'identifiant qui la relie aux
 * journaux du serveur (en production, le message d'une erreur serveur est masqué au navigateur).
 */
const ErrorPage = ({ error, retry }: Props) => {
  useEffect(() => {
    console.error("[site] erreur de rendu", { digest: error.digest }, error);
  }, [error]);
  return <ErrorScreen onRetry={retry} />;
};

export default ErrorPage;
