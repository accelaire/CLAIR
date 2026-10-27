"use client";

import { useApiQuery } from "@clair/api-client";
import {
  type ApiData,
  type GroupeOption,
  type HistoriqueCarriere,
  type PageMeta,
  type ParlementaireListItem,
  pageOf,
  type RangClassement,
} from "@clair/data";
import {
  Badge,
  ChambreBadge,
  ChambreSwitch,
  DataTable,
  type DataTableColumn,
  ErrorState,
  FilterBar,
  GroupeBadge,
  Link,
  LoadingState,
  Pagination,
  SortSelect,
  TopFlop,
  type TopFlopItem,
} from "@clair/ui";
import { NativeSelect } from "@mantine/core";
import { formatNombre, formatPourcent } from "../groupes-liste/format.ts";
import classes from "./ClassementsScreen.module.css";
import {
  type ClassementsParams,
  type CritereParlementaire,
  classementQueryOf,
  PAR_PAGE,
  pageEffective,
} from "./params.ts";

export const METHODOLOGIE_INDICATEURS = "/comprendre/parlementaire";

type Statistique = Exclude<CritereParlementaire, "nom">;

const CRITERES: Record<Statistique, { label: string; format: (valeur: number) => string }> = {
  presence: { label: "Présence", format: formatPourcent },
  loyaute: { label: "Loyauté", format: formatPourcent },
  amendements: { label: "Amendements", format: formatNombre },
  interventions: { label: "Interventions", format: formatNombre },
};

const OPTIONS_TRI = [
  { value: "presence", label: "Présence" },
  { value: "loyaute", label: "Loyauté" },
  { value: "amendements", label: "Amendements" },
  { value: "interventions", label: "Interventions" },
  { value: "nom", label: "Alphabétique" },
];

/**
 * « Mandat en cours » est le défaut : seul choix qui compare les élus à dénominateur égal ; la
 * carrière cumule tous les mandats et avantage mécaniquement les réélus.
 */
const OPTIONS_PERIODE = [
  { value: "mandat", label: "Mandat en cours" },
  { value: "carriere", label: "Carrière complète" },
];

const estCritere = (key: string): key is CritereParlementaire =>
  key === "nom" || Object.hasOwn(CRITERES, key);

const valeur = (item: ParlementaireListItem, critere: Statistique) => item.stats?.[critere] ?? null;

/** Un parlementaire sans aucune statistique n'a pas sa place dans un top ou un flop. */
const aDesDonnees = ({ stats }: ParlementaireListItem) =>
  stats !== null &&
  [stats.presence, stats.loyaute, stats.amendements, stats.interventions].some(
    (nombre) => nombre !== null && nombre > 0,
  );

const ficheHref = (item: ParlementaireListItem) =>
  `${item.chambre === "assemblee" ? "/deputes" : "/senateurs"}/${item.slug}`;

const versTopFlop = (item: ParlementaireListItem, critere: Statistique): TopFlopItem => ({
  id: item.id,
  name: `${item.prenom} ${item.nom}`,
  href: ficheHref(item),
  value: valeur(item, critere),
  detail: item.groupe?.nom,
});

const endpointGroupes = (chambre: ClassementsParams["chambre"]) =>
  chambre === "assemblee" ? "/deputes" : chambre === "senat" ? "/senateurs" : "/parlementaires";

type OngletParlementairesProps = {
  params: ClassementsParams;
  update: (patch: Partial<ClassementsParams>) => void;
  hrefFor: (patch: Partial<ClassementsParams>) => string;
};

/**
 * Classement des parlementaires : chambre, groupe, critère et période ; top et flop du critère
 * (première page, tous groupes), tableau triable et pagination en liens. Un parlementaire mis en
 * avant (`highlight`) est retrouvé sur sa page grâce à son rang.
 */
export const OngletParlementaires = ({ params, update, hrefFor }: OngletParlementairesProps) => {
  const attendreRang = Boolean(params.highlight) && params.rank === null;
  const rangQuery = useApiQuery<ApiData<RangClassement>>(
    `/parlementaires/${encodeURIComponent(params.highlight ?? "")}/rank`,
    {
      sort: params.sort,
      order: params.order,
      periode: params.periode,
      chambre: params.chambre,
      groupe: params.groupe,
    },
    { enabled: attendreRang },
  );
  const rang = params.rank ?? rangQuery.data?.data.rank ?? null;
  const rangEnAttente = attendreRang && rangQuery.isPending;
  const page = pageEffective(params, rang);

  const query = useApiQuery<PageMeta<ParlementaireListItem>>(
    "/parlementaires",
    classementQueryOf(params, page),
    { enabled: !rangEnAttente },
  );
  const critere: Statistique | null = params.sort === "nom" ? null : params.sort;
  const avecTopFlop =
    !rangEnAttente && page === 1 && !params.groupe && params.order === "desc" && critere !== null;
  const flopQuery = useApiQuery<PageMeta<ParlementaireListItem>>(
    "/parlementaires",
    {
      chambre: params.chambre,
      sort: params.sort,
      order: "asc",
      periode: params.periode,
      page: 1,
      limit: 5,
    },
    { enabled: avecTopFlop },
  );
  const groupesQuery = useApiQuery<ApiData<GroupeOption[]>>(
    `${endpointGroupes(params.chambre)}/groupes`,
  );
  const historiqueQuery = useApiQuery<ApiData<HistoriqueCarriere>>(
    `${endpointGroupes(params.chambre)}/historique-carriere`,
  );
  const avecPeriode =
    (params.sort === "presence" || params.sort === "loyaute") &&
    (historiqueQuery.data?.data.present ?? false);

  const resultats = query.data ? pageOf(query.data) : null;
  const premier = (page - 1) * PAR_PAGE;

  const colonnes: DataTableColumn<ParlementaireListItem>[] = [
    {
      key: "rang",
      header: "Rang",
      align: "end",
      cell: (item) => (
        <span className="clair-chiffres">
          {premier + (resultats?.items.indexOf(item) ?? 0) + 1}
        </span>
      ),
    },
    {
      key: "nom",
      header: "Parlementaire",
      rowHeader: true,
      sortValue: (item) => item.nom,
      cell: (item) => (
        <span className={classes.nom}>
          <Link href={ficheHref(item)}>
            {item.prenom} {item.nom}
          </Link>
          {item.slug === params.highlight ? <Badge size="sm">Mis en avant</Badge> : null}
        </span>
      ),
    },
    {
      key: "groupe",
      header: "Groupe",
      cell: (item) =>
        item.groupe ? (
          <GroupeBadge
            sigle={item.groupe.nom}
            nom={item.groupe.nomComplet}
            couleur={item.groupe.couleur}
            size="sm"
          />
        ) : (
          "—"
        ),
    },
    ...(params.chambre
      ? []
      : [
          {
            key: "chambre",
            header: "Chambre",
            cell: (item: ParlementaireListItem) => (
              <ChambreBadge chambre={item.chambre} short size="sm" />
            ),
          },
        ]),
    ...(Object.keys(CRITERES) as Statistique[]).map(
      (cle): DataTableColumn<ParlementaireListItem> => ({
        key: cle,
        header: CRITERES[cle].label,
        align: "end",
        firstDirection: "descending",
        sortValue: (item) => valeur(item, cle),
        cell: (item) => {
          const nombre = valeur(item, cle);
          return nombre === null ? "—" : CRITERES[cle].format(nombre);
        },
      }),
    ),
  ];

  const groupes = groupesQuery.data?.data ?? [];

  return (
    <div className={classes.onglet}>
      <FilterBar
        label="Filtrer le classement des parlementaires"
        activeFilters={
          params.groupe
            ? [
                {
                  id: `groupe=${params.groupe}`,
                  label: `Groupe : ${groupes.find((groupe) => groupe.slug === params.groupe)?.nom ?? params.groupe}`,
                  onRemove: () => update({ groupe: "", rank: null }),
                },
              ]
            : []
        }
        onReset={() => update({ groupe: "", rank: null })}
      >
        <ChambreSwitch
          value={params.chambre}
          onChange={(chambre) => update({ chambre, groupe: "", highlight: "", rank: null })}
        />
        <SortSelect
          label="Critère"
          value={params.sort}
          options={OPTIONS_TRI}
          onChange={(sort) => {
            if (estCritere(sort))
              update({ sort, order: sort === "nom" ? "asc" : "desc", rank: null });
          }}
        />
        {avecPeriode ? (
          <SortSelect
            label="Période"
            value={params.periode}
            options={OPTIONS_PERIODE}
            onChange={(periode) =>
              update({ periode: periode === "carriere" ? "carriere" : "mandat", rank: null })
            }
          />
        ) : null}
        <NativeSelect
          label="Groupe politique"
          value={params.groupe}
          onChange={(event) =>
            update({ groupe: event.currentTarget.value, highlight: "", rank: null })
          }
          data={[
            { value: "", label: "Tous les groupes" },
            ...groupes.map((groupe) => ({
              value: groupe.slug,
              label: `${groupe.nom}${groupe.nomComplet && groupe.nomComplet !== groupe.nom ? ` (${groupe.nomComplet})` : ""}`,
            })),
          ]}
        />
      </FilterBar>

      {avecTopFlop && critere && resultats && flopQuery.data ? (
        <TopFlop
          criterion={CRITERES[critere].label}
          top={resultats.items
            .filter(aDesDonnees)
            .slice(0, 5)
            .map((item) => versTopFlop(item, critere))}
          flop={flopQuery.data.data.filter(aDesDonnees).map((item) => versTopFlop(item, critere))}
          formatValue={CRITERES[critere].format}
          headingLevel={3}
          provenance="calculee"
          methodologyHref={METHODOLOGIE_INDICATEURS}
        />
      ) : null}

      {query.isPending ? (
        <LoadingState label="Chargement du classement…" variant="skeleton" lines={8} />
      ) : query.isError ? (
        <ErrorState
          message="Le classement n'a pas pu être chargé. Vérifiez votre connexion puis réessayez."
          onRetry={() => query.refetch()}
        />
      ) : resultats ? (
        <>
          <p className={classes.count} aria-live="polite">
            {formatNombre(resultats.total)} parlementaire{resultats.total > 1 ? "s" : ""}
          </p>
          <DataTable
            caption={`Classement des parlementaires par ${OPTIONS_TRI.find((option) => option.value === params.sort)?.label.toLowerCase() ?? "critère"}, page ${resultats.page}`}
            columns={colonnes}
            rows={resultats.items}
            getRowKey={(item) => item.id}
            manualSort
            sort={{
              key: params.sort,
              direction: params.order === "asc" ? "ascending" : "descending",
            }}
            onSortChange={({ key, direction }) => {
              if (estCritere(key))
                update({
                  sort: key,
                  order: direction === "ascending" ? "asc" : "desc",
                  rank: null,
                });
            }}
            emptyLabel="Aucun parlementaire ne correspond à ces filtres"
          />
          <Pagination
            page={resultats.page}
            total={resultats.totalPages}
            hrefFor={(numero) => hrefFor({ page: numero })}
            label="Pages du classement"
          />
        </>
      ) : null}
    </div>
  );
};
