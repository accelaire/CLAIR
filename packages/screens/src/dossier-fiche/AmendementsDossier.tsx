"use client";

import { useApiQuery } from "@clair/api-client";
import { type AmendementDuDossier, type DossierDetail, type PageMeta, pageOf } from "@clair/data";
import {
  AmendementCard,
  Button,
  EmptyState,
  ErrorState,
  FilterBar,
  LoadingState,
  Pagination,
} from "@clair/ui";
import { Checkbox, NativeSelect } from "@mantine/core";
import { scrutinHref } from "../shared/scrutins.ts";
import classes from "./DossierFicheScreen.module.css";
import { type DossierFicheParams, filtreAmendementActif } from "./params.ts";

const PAR_PAGE = 20;

/** Ancre d'un amendement dans la page (`#amendement-<uid>`). */
export const ancreAmendement = (uid: string) => `amendement-${uid}`;

export type AmendementsDossierProps = {
  dossier: DossierDetail;
  params: DossierFicheParams;
  onChange: (patch: Partial<DossierFicheParams>) => void;
  hrefFor: (page: number) => string;
};

const Carte = ({
  amendement,
  dossierUid,
  highlighted = false,
}: {
  amendement: AmendementDuDossier;
  dossierUid: string;
  highlighted?: boolean;
}) => (
  <AmendementCard
    as="li"
    id={ancreAmendement(amendement.uid)}
    highlighted={highlighted}
    amendement={amendement}
    parentHref={
      amendement.amendementParent
        ? `/dossiers/${encodeURIComponent(dossierUid)}?tab=amendements&amendement=${encodeURIComponent(amendement.amendementParent.uid)}`
        : undefined
    }
    scrutins={amendement.scrutins.map((scrutin) => ({
      numero: scrutin.numero,
      href: scrutinHref(scrutin),
    }))}
  />
);

/** L'amendement visé par un lien (`?amendement=<uid>`), chargé seul et épinglé en tête. */
const AmendementEpingle = ({
  dossierUid,
  uid,
  onForget,
}: {
  dossierUid: string;
  uid: string;
  onForget: () => void;
}) => {
  const query = useApiQuery<PageMeta<AmendementDuDossier>>(
    `/dossiers/${encodeURIComponent(dossierUid)}/amendements`,
    { amendement: uid, limit: 1 },
  );
  const amendement = query.data?.data[0];
  return (
    <section className={classes.epingle} aria-labelledby="amendement-demande">
      <div className={classes.epingleEnTete}>
        <h3 id="amendement-demande" className={classes.epingleTitre}>
          L'amendement demandé
        </h3>
        <Button variant="tertiaire" size="sm" onClick={onForget}>
          Revenir à la liste seule
        </Button>
      </div>
      {query.isPending ? (
        <LoadingState label="Chargement de l'amendement…" />
      ) : amendement ? (
        <ul className={classes.liste}>
          <Carte amendement={amendement} dossierUid={dossierUid} highlighted />
        </ul>
      ) : (
        <EmptyState title="Cet amendement n'est pas rangé dans ce dossier." />
      )}
    </section>
  );
};

/**
 * Amendements du dossier, du plus récent au plus ancien : filtres « votes publics », groupe de
 * l'auteur et sort (dans l'URL), amendement épinglé, pagination en liens. La première page sans
 * filtre vient du détail du dossier.
 */
export const AmendementsDossier = ({
  dossier,
  params,
  onChange,
  hrefFor,
}: AmendementsDossierProps) => {
  const filtre = filtreAmendementActif(params);
  const premiere = params.page === 1 && !filtre;
  const query = useApiQuery<PageMeta<AmendementDuDossier>>(
    `/dossiers/${encodeURIComponent(dossier.uid)}/amendements`,
    {
      page: params.page,
      limit: PAR_PAGE,
      voted: params.voted,
      groupe: params.groupe,
      sort: params.sort,
    },
    {
      initialData: premiere
        ? {
            data: dossier.amendements,
            meta: {
              total: dossier.amendementsCount,
              page: 1,
              limit: PAR_PAGE,
              totalPages: Math.ceil(dossier.amendementsCount / PAR_PAGE),
            },
          }
        : undefined,
    },
  );
  const resultats = query.data ? pageOf(query.data) : null;
  const items = (resultats?.items ?? []).filter((a) => a.uid !== params.amendement);
  const sorts = [
    ...new Set(
      [...dossier.amendements, ...(resultats?.items ?? [])]
        .map((a) => a.sort)
        .filter((sort): sort is string => Boolean(sort)),
    ),
  ];
  if (params.sort && !sorts.includes(params.sort)) sorts.push(params.sort);
  sorts.sort((a, b) => a.localeCompare(b, "fr"));
  const groupe = dossier.amendementsGroupes.find((g) => g.slug === params.groupe);
  const actifs = [
    params.voted
      ? { id: "voted", label: "Votes publics", onRemove: () => onChange({ voted: false }) }
      : null,
    params.groupe
      ? {
          id: `groupe=${params.groupe}`,
          label: `Groupe : ${groupe?.nom ?? params.groupe}`,
          onRemove: () => onChange({ groupe: "" }),
        }
      : null,
    params.sort
      ? {
          id: `sort=${params.sort}`,
          label: `Sort : ${params.sort}`,
          onRemove: () => onChange({ sort: "" }),
        }
      : null,
  ].filter((actif) => actif !== null);

  return (
    <div className={classes.onglet}>
      <FilterBar
        label="Filtrer les amendements"
        activeFilters={actifs}
        onReset={() => onChange({ voted: false, groupe: "", sort: "" })}
      >
        {dossier.votedAmendementsCount > 0 ? (
          <Checkbox
            className={classes.case}
            label={`Votes publics seulement (${dossier.votedAmendementsCount.toLocaleString("fr-FR")})`}
            checked={params.voted}
            onChange={(event) => onChange({ voted: event.currentTarget.checked })}
          />
        ) : null}
        {dossier.amendementsGroupes.length > 0 ? (
          <NativeSelect
            label="Groupe de l'auteur"
            value={params.groupe}
            onChange={(event) => onChange({ groupe: event.currentTarget.value })}
            data={[
              { value: "", label: "Tous les groupes" },
              ...dossier.amendementsGroupes.map((g) => ({
                value: g.slug,
                label: `${g.nom} (${g.count})`,
              })),
            ]}
          />
        ) : null}
        {sorts.length > 0 ? (
          <NativeSelect
            label="Sort"
            value={params.sort}
            onChange={(event) => onChange({ sort: event.currentTarget.value })}
            data={[{ value: "", label: "Tous les sorts" }, ...sorts]}
          />
        ) : null}
      </FilterBar>

      {params.amendement ? (
        <AmendementEpingle
          dossierUid={dossier.uid}
          uid={params.amendement}
          onForget={() => onChange({ amendement: "" })}
        />
      ) : null}

      {query.isPending ? (
        <LoadingState label="Chargement des amendements…" />
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : resultats && items.length > 0 ? (
        <>
          <p className={classes.mention} aria-live="polite">
            {resultats.total.toLocaleString("fr-FR")} amendement{resultats.total > 1 ? "s" : ""}
            {filtre ? " correspondant aux filtres" : ""}
          </p>
          <ul className={classes.liste}>
            {items.map((amendement) => (
              <Carte key={amendement.id} amendement={amendement} dossierUid={dossier.uid} />
            ))}
          </ul>
          <Pagination
            page={resultats.page}
            total={resultats.totalPages}
            hrefFor={hrefFor}
            label="Pages d'amendements"
          />
        </>
      ) : (
        <EmptyState
          title={
            filtre
              ? "Aucun amendement correspondant aux filtres"
              : "Aucun amendement associé à ce dossier"
          }
        />
      )}
    </div>
  );
};
