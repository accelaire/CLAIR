import { ApiError, type FixtureRoutes } from "@clair/api-client";
import type { Navigation } from "@clair/ui";

/**
 * Paramètres d'une story d'écran, lus par le décorateur `withApi` de l'atelier
 * (`apps/storybook/.storybook/preview.tsx`) : réponses de l'API (fixtures fictives, jamais de
 * réseau ; un chemin absent répond 404), adresse courante et espion de navigation.
 */
export type ParametresEcran = {
  api: FixtureRoutes;
  navigation: { pathname: string; navigate?: Navigation["navigate"] };
};

export const parametresEcran = (
  pathname: string,
  api: FixtureRoutes,
  navigate?: Navigation["navigate"],
): ParametresEcran => ({ api, navigation: { pathname, navigate } });

/** Réponse qui ne vient jamais : l'écran reste dans son état de chargement. */
export const jamais = () => new Promise<never>(() => {});

/** Réponse en erreur de l'API (500 par défaut, 404 pour la page introuvable). */
export const enErreur =
  (status = 500, chemin = "/") =>
  () =>
    Promise.reject(new ApiError(status, chemin));
