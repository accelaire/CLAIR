"use client";

import { type PageMeta, pageOf } from "@clair/data";
import { EmptyState, ErrorState, LoadingState, Pagination } from "@clair/ui";
import type { ReactNode } from "react";
import { formatNombre } from "../shared/parlementaires/chambre.ts";
import classes from "./ParlementaireFicheScreen.module.css";

type ListeOngletProps<T> = {
  /** Résultat de `useApiQuery` pour la page demandée. */
  query: { data?: PageMeta<T>; isPending: boolean; isError: boolean; refetch: () => unknown };
  /** Ce qui est listé, au pluriel (« votes »), pour les messages. */
  nom: string;
  vide: string;
  /** Filtres de l'onglet, au-dessus de la liste. */
  filtres?: ReactNode;
  pageHref: (page: number) => string;
  renderItem: (item: T) => ReactNode;
  getKey: (item: T) => string;
};

/**
 * Contenu paginé d'un onglet de la fiche : filtres, chargement, erreur récupérable, état vide,
 * liste et pagination en liens (page dans l'URL).
 */
export const ListeOnglet = <T,>({
  query,
  nom,
  vide,
  filtres,
  pageHref,
  renderItem,
  getKey,
}: ListeOngletProps<T>) => {
  const page = query.data ? pageOf(query.data) : null;
  return (
    <div className={classes.onglet}>
      {filtres ? <div className={classes.filtres}>{filtres}</div> : null}
      {query.isPending ? (
        <LoadingState label={`Chargement des ${nom}…`} variant="skeleton" lines={5} />
      ) : query.isError ? (
        <ErrorState
          message={`Les ${nom} n'ont pas pu être chargés. Vérifiez votre connexion puis réessayez.`}
          onRetry={() => query.refetch()}
        />
      ) : !page || page.items.length === 0 ? (
        <EmptyState title={vide} />
      ) : (
        <>
          <p className={classes.compte} role="status">
            {formatNombre(page.total)} {nom}
            {page.totalPages > 1 ? ` — page ${page.page} sur ${page.totalPages}` : null}
          </p>
          <ul className={classes.liste}>
            {page.items.map((item) => (
              <li key={getKey(item)}>{renderItem(item)}</li>
            ))}
          </ul>
          <Pagination
            page={page.page}
            total={page.totalPages}
            hrefFor={pageHref}
            label={`Pages des ${nom}`}
          />
        </>
      )}
    </div>
  );
};
