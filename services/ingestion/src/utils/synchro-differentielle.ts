import { empreinte } from './empreinte';

/**
 * Synchronisation par différence : ce qu'il faut créer, modifier et supprimer
 * pour qu'un ensemble de lignes en base devienne l'ensemble voulu.
 *
 * POURQUOI PAS « EFFACER PUIS RECRÉER ». C'est la façon la plus simple de faire
 * disparaître une ligne retirée à la source, mais chaque passage donne de
 * nouveaux identifiants à des lignes qui n'ont pas changé. Mesuré en prod le
 * 18/10/2026 : 184 000 secteurs d'actions HATVP, 18 900 secteurs de
 * lobbyistes, les 1 936 candidatures et ~37 700 votes du Sénat recréés en une
 * nuit, à l'identique. Un consommateur qui suit nos lignes par identifiant
 * (Data for Good, ticket #95) les voyait toutes disparaître et réapparaître,
 * et `updated_at` les aurait toutes déclarées modifiées.
 *
 * La comparaison ne porte que sur `champs` : les colonnes que l'appelant écrit.
 * Une colonne posée par une autre étape (un lien de dossier, une stat) n'est
 * donc ni comparée ni écrasée. L'égalité passe par `empreinte()`, qui lit une
 * date sous sa forme ISO, confond `undefined` et `null` comme la base, et ne
 * dépend pas de l'ordre des clés d'un JSON.
 */
export interface Difference<V, E> {
  aCreer: V[];
  aModifier: Array<{ existant: E; voulu: V }>;
  aSupprimer: E[];
  inchanges: number;
}

export function differencier<V extends object, E extends object>(
  existants: readonly E[],
  voulus: readonly V[],
  cle: { existant: (e: E) => string; voulu: (v: V) => string },
  champs: readonly (keyof V & keyof E & string)[],
): Difference<V, E> {
  const parCle = new Map<string, E>();
  for (const e of existants) parCle.set(cle.existant(e), e);

  const aCreer: V[] = [];
  const aModifier: Array<{ existant: E; voulu: V }> = [];
  const vus = new Set<string>();
  let inchanges = 0;

  for (const v of voulus) {
    const k = cle.voulu(v);
    // Deux lignes voulues sur la même clé : la première l'emporte. L'appelant
    // qui veut une autre règle doit dédoublonner avant, explicitement.
    if (vus.has(k)) continue;
    vus.add(k);

    const e = parCle.get(k);
    if (!e) {
      aCreer.push(v);
    } else if (empreinte(extraire(e, champs)) === empreinte(extraire(v, champs))) {
      inchanges++;
    } else {
      aModifier.push({ existant: e, voulu: v });
    }
  }

  const aSupprimer = existants.filter((e) => !vus.has(cle.existant(e)));
  return { aCreer, aModifier, aSupprimer, inchanges };
}

function extraire(ligne: object, champs: readonly string[]): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  for (const c of champs) r[c] = (ligne as Record<string, unknown>)[c];
  return r;
}

/** Découpe une liste en tranches, pour borner la taille des requêtes. */
export function tranches<T>(liste: readonly T[], taille: number): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < liste.length; i += taille) r.push(liste.slice(i, i + taille));
  return r;
}

/**
 * Les liens d'une relation M:N implicite de Prisma à connecter et à
 * déconnecter pour passer de `courants` à `voulus`, ou `undefined` s'il n'y a
 * rien à faire.
 *
 * Remplace `{ set: voulus }` : Prisma le joue en effaçant TOUS les liens
 * existants puis en les réinsérant (constaté le 18/10/2026 dans les requêtes
 * qu'il émet), si bien que le parent est daté comme modifié par
 * `clair_touch_parent` même quand la liste n'a pas changé.
 */
export function alignerLiens(
  courants: readonly string[],
  voulus: readonly string[],
): { connect?: { id: string }[]; disconnect?: { id: string }[] } | undefined {
  const avant = new Set(courants);
  const apres = new Set(voulus);
  const connect = [...apres].filter((id) => !avant.has(id)).map((id) => ({ id }));
  const disconnect = [...avant].filter((id) => !apres.has(id)).map((id) => ({ id }));
  if (connect.length === 0 && disconnect.length === 0) return undefined;
  return {
    ...(connect.length > 0 ? { connect } : {}),
    ...(disconnect.length > 0 ? { disconnect } : {}),
  };
}
