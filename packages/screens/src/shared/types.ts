import type { QueryParams } from "@clair/ui";

/** Props communes des écrans : paramètres d'URL, et données chargées par la route côté serveur. */
export type ScreenProps<TInitial = never> = {
  params?: QueryParams;
  initialData?: TInitial;
};
