"use client";

import { useApiQuery } from "@clair/api-client";
import { type DossierDetail, type PageMeta, pageOf, type ScrutinDuDossier } from "@clair/data";
import { EmptyState, ErrorState, LoadingState, Pagination, ScrutinCard } from "@clair/ui";
import { NativeSelect } from "@mantine/core";
import { NATURES_VOTE, periodeScrutin, scrutinHref } from "../shared/scrutins.ts";
import classes from "./DossierFicheScreen.module.css";

const PAR_PAGE = 20;

export type ScrutinsDossierProps = {
  dossier: DossierDetail;
  nature: string;
  page: number;
  onNatureChange: (nature: string) => void;
  hrefFor: (page: number) => string;
};

/**
 * Scrutins du dossier, du plus récent au plus ancien, filtrables par objet du vote (les
 * compteurs portent sur tout le dossier). La première page sans filtre vient du détail du
 * dossier ; les suivantes de `/dossiers/:uid/scrutins`.
 */
export const ScrutinsDossier = ({
  dossier,
  nature,
  page,
  onNatureChange,
  hrefFor,
}: ScrutinsDossierProps) => {
  const premiere = page === 1 && nature === "";
  const query = useApiQuery<PageMeta<ScrutinDuDossier>>(
    `/dossiers/${encodeURIComponent(dossier.uid)}/scrutins`,
    { page, limit: PAR_PAGE, nature },
    {
      initialData: premiere
        ? {
            data: dossier.scrutins,
            meta: {
              total: dossier.scrutinsCount,
              page: 1,
              limit: PAR_PAGE,
              totalPages: Math.ceil(dossier.scrutinsCount / PAR_PAGE),
            },
          }
        : undefined,
    },
  );
  const naturesCount = dossier.naturesCount ?? {};
  const natures = Object.keys(NATURES_VOTE).filter((cle) => (naturesCount[cle] ?? 0) > 0);
  const resultats = query.data ? pageOf(query.data) : null;

  return (
    <div className={classes.onglet}>
      {natures.length > 1 ? (
        <NativeSelect
          label="Objet du vote"
          className={classes.filtre}
          value={nature}
          onChange={(event) => onNatureChange(event.currentTarget.value)}
          data={[
            { value: "", label: `Tous les votes (${dossier.scrutinsCount})` },
            ...natures.map((cle) => ({
              value: cle,
              label: `${NATURES_VOTE[cle]} (${naturesCount[cle]})`,
            })),
          ]}
        />
      ) : null}
      {query.isPending ? (
        <LoadingState label="Chargement des scrutins…" />
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : resultats && resultats.items.length > 0 ? (
        <>
          <ul className={classes.liste}>
            {resultats.items.map((scrutin) => (
              <ScrutinCard
                key={scrutin.id}
                as="li"
                titleAs="h3"
                href={scrutinHref(scrutin)}
                periode={periodeScrutin(scrutin)}
                scrutin={scrutin}
              />
            ))}
          </ul>
          <Pagination
            page={resultats.page}
            total={resultats.totalPages}
            hrefFor={hrefFor}
            label="Pages de scrutins"
          />
        </>
      ) : (
        <EmptyState
          title="Aucun scrutin"
          description={
            nature
              ? "Aucun scrutin de ce type pour ce dossier."
              : "Aucun scrutin associé à ce dossier."
          }
        />
      )}
    </div>
  );
};
