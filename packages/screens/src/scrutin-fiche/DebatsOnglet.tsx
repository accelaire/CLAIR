"use client";

import { useApiQuery } from "@clair/api-client";
import type { InterventionsScrutinResponse, ScrutinDetail } from "@clair/data";
import {
  Callout,
  EmptyState,
  ErrorState,
  Link,
  LoadingState,
  Pagination,
  SearchInput,
  SortSelect,
} from "@clair/ui";
import { NativeSelect } from "@mantine/core";
import { scrutinQuery } from "../shared/scrutins.ts";
import { Intervention } from "./Intervention.tsx";
import { NATURES_PAROLE, type NatureDebat, type ScrutinFicheParams } from "./params.ts";
import classes from "./ScrutinFicheScreen.module.css";
import { seanceHref } from "./ScrutinInfos.tsx";

/** Prises de parole par page. */
const PAR_PAGE = 10;

type DebatsOngletProps = {
  scrutin: ScrutinDetail;
  params: ScrutinFicheParams;
  update: (patch: Partial<ScrutinFicheParams>) => void;
  hrefFor: (page: number) => string;
};

/** Ce que montre le débat, selon la finesse de son rattachement au vote. */
const Rattachement = ({
  meta,
  seance,
}: {
  meta: InterventionsScrutinResponse["meta"] | undefined;
  seance: string | null;
}) => {
  if (meta?.rattachement === "journee") {
    return (
      <Callout tone="avertissement" title="Débats de la journée">
        Ce vote n'a pas pu être relié à un moment précis du compte rendu : voici les débats de la
        journée, qui peuvent porter sur d'autres textes.
      </Callout>
    );
  }
  if (meta?.rattachement !== "scrutin") return null;
  if (meta.precision === "fenetre" || meta.precision === "finances") {
    return (
      <p className={classes.mention}>
        {meta.precision === "fenetre"
          ? "Voici le débat qui a précédé ce vote sur ce texte."
          : "Voici la discussion de la partie du budget où ce vote est intervenu."}{" "}
        Le compte rendu ne permet pas de le resserrer davantage.
      </p>
    );
  }
  return (
    <p className={classes.mention}>
      Les prises de parole qui ont précédé ce vote, extraites de la séance.
      {seance ? (
        <>
          {" "}
          <Link href={seance}>Voir le débat complet</Link>
        </>
      ) : null}
    </p>
  );
};

/**
 * Onglet « Débats » : prises de parole qui ont précédé le vote (ou, faute de rattachement, celles
 * de la journée, signalées comme telles). Nature, ordre, recherche et page vivent dans l'URL ; les
 * explications de vote passent devant quand il y en a, sauf choix contraire du lecteur.
 */
export const DebatsOnglet = ({ scrutin, params, update, hrefFor }: DebatsOngletProps) => {
  const path = `/scrutins/${scrutin.numero}/interventions`;
  const base = {
    ...scrutinQuery(scrutin),
    sort: params.ordre,
    search: params.q,
    limit: PAR_PAGE,
  };
  // Le décompte par nature arrive avec la première page sans filtre de nature : les explications
  // de vote passent devant quand il y en a, sauf choix explicite du lecteur (`toutes`, une nature).
  const compteur = useApiQuery<InterventionsScrutinResponse>(path, { ...base, type: "", page: 1 });
  const parType = compteur.data?.meta.parType ?? {};
  const nature: NatureDebat =
    params.nature === "toutes"
      ? ""
      : params.nature !== ""
        ? params.nature
        : (parType.explication_vote ?? 0) > 0
          ? "explication_vote"
          : "";
  const query = useApiQuery<InterventionsScrutinResponse>(
    path,
    { ...base, type: nature, page: params.page },
    { enabled: params.nature !== "" || !compteur.isPending },
  );
  const donnees = query.data;
  const enCours = compteur.isPending || query.isPending;
  const seance = seanceHref(scrutin);

  const naturesPresentes = NATURES_PAROLE.filter((item) => (parType[item.valeur] ?? 0) > 0);
  const totalNatures = Object.values(parType).reduce((total, n) => total + n, 0);
  const sourceUrl = donnees?.data
    .find((item) => item.sourceUrl)
    ?.sourceUrl?.replace(/#par_\d+$/, "");

  return (
    <div className={classes.onglet}>
      <Rattachement meta={donnees?.meta ?? compteur.data?.meta} seance={seance} />
      <div className={classes.filtres}>
        <SearchInput
          label="Chercher dans les débats"
          value={params.q}
          debounceMs={300}
          onChange={(q) => update({ q, page: 1 })}
        />
        {naturesPresentes.length > 1 ? (
          <NativeSelect
            label="Nature des prises de parole"
            value={nature === "" ? "toutes" : nature}
            onChange={(event) => {
              const valeur = event.currentTarget.value;
              update({
                nature: NATURES_PAROLE.find((item) => item.valeur === valeur)?.valeur ?? "toutes",
                page: 1,
              });
            }}
            data={[
              { value: "toutes", label: `Toutes les prises de parole (${totalNatures})` },
              ...naturesPresentes.map((item) => ({
                value: item.valeur,
                label: `${item.libelle} (${parType[item.valeur]})`,
              })),
            ]}
          />
        ) : null}
        <SortSelect
          label="Ordre"
          value={params.ordre}
          onChange={(ordre) => update({ ordre: ordre === "desc" ? "desc" : "asc", page: 1 })}
          options={[
            { value: "asc", label: "Plus anciennes d'abord" },
            { value: "desc", label: "Plus récentes d'abord" },
          ]}
        />
      </div>

      {enCours ? (
        <LoadingState label="Chargement des débats…" variant="skeleton" lines={5} />
      ) : query.isError || compteur.isError ? (
        <ErrorState
          message="Les débats n'ont pas pu être chargés."
          onRetry={() => {
            compteur.refetch();
            query.refetch();
          }}
        />
      ) : donnees && donnees.data.length > 0 ? (
        <>
          <ol className={classes.interventions}>
            {donnees.data.map((intervention) => {
              const defense = scrutin.amendements.find(
                (amendement) => amendement.defense?.id === intervention.id,
              );
              return (
                <li key={intervention.id}>
                  <Intervention
                    intervention={intervention}
                    chambre={scrutin.chambre}
                    defend={defense?.numero}
                  />
                </li>
              );
            })}
          </ol>
          <Pagination
            page={donnees.meta.page}
            total={donnees.meta.totalPages}
            hrefFor={hrefFor}
            label="Pages des débats"
          />
        </>
      ) : (
        <EmptyState
          title={params.q ? `Aucun résultat pour « ${params.q} »` : "Aucune prise de parole"}
        />
      )}

      {seance || sourceUrl ? (
        <p className={classes.mention}>
          {seance ? <Link href={seance}>Lire ce passage dans toute la séance</Link> : null}
          {seance && sourceUrl ? " · " : null}
          {sourceUrl ? (
            <Link href={sourceUrl} external>
              Compte rendu officiel sur{" "}
              {scrutin.chambre === "senat" ? "senat.fr" : "assemblee-nationale.fr"}
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
};
