import { asString, type ChambreSwitchValue, type QueryParams } from "@clair/ui";

/** État de la liste des groupes dans l'URL (mêmes clés que apps/web). */
export type GroupesListeParams = {
  search: string;
  chambre: ChambreSwitchValue;
  /** Législature de l'Assemblée ; vide : la plus récente. */
  legislature: string;
  /** Session du Sénat (année de début) ; vide : la session courante. */
  session: string;
};

const NOMBRE = /^\d{1,4}$/;

/** Lit l'URL ; une valeur inconnue ou mal formée est ignorée. */
export const parseGroupesListeParams = (params: QueryParams = {}): GroupesListeParams => {
  const chambre = asString(params.chambre);
  const legislature = asString(params.legislature);
  const session = asString(params.session);
  return {
    search: asString(params.search).trim(),
    chambre: chambre === "assemblee" || chambre === "senat" ? chambre : "",
    legislature: NOMBRE.test(legislature) ? legislature : "",
    session: NOMBRE.test(session) ? session : "",
  };
};

/** Paramètres d'URL ; les valeurs vides sont omises. */
export const groupesListeParamsOf = (params: GroupesListeParams) => ({
  search: params.search,
  chambre: params.chambre,
  legislature: params.legislature,
  session: params.session,
});

/** Route d'API de la liste : une chambre, ou les deux. */
export const groupesEndpointOf = ({ chambre }: GroupesListeParams) =>
  chambre === "assemblee"
    ? "/deputes/groupes"
    : chambre === "senat"
      ? "/senateurs/groupes"
      : "/parlementaires/groupes";

/** Paramètres de la requête de la liste (période choisie). */
export const groupesQueryOf = ({ legislature, session }: GroupesListeParams) => ({
  legislature,
  session,
});

/** La vue par défaut (sans chambre ni période) : celle que la route charge côté serveur. */
export const estVueParDefaut = (params: GroupesListeParams) =>
  !params.chambre && !params.legislature && !params.session;
