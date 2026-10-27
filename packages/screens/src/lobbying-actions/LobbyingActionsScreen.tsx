"use client";

import { useApiQuery } from "@clair/api-client";
import {
  LOBBYING_CIBLE_LIBELLES,
  LOBBYING_CIBLES,
  type LobbyingActionsPage,
  type LobbyingSecteur,
  pageOf,
} from "@clair/data";
import {
  type ActiveFilter,
  Button,
  buildHref,
  Container,
  DateRangePicker,
  EmptyState,
  ErrorState,
  FilterBar,
  Link,
  LoadingState,
  MultiSelectFilter,
  PageHeader,
  Pagination,
  SearchInput,
  SortSelect,
  useNavigation,
} from "@clair/ui";
import { NativeSelect } from "@mantine/core";
import { ActionLobbying } from "../lobbying-liste/ActionLobbying.tsx";
import { cibleLibelle, formatJour } from "../lobbying-liste/format.ts";
import type { ScreenProps } from "../shared/types.ts";
import classes from "./LobbyingActionsScreen.module.css";
import {
  actionsQueryOf,
  aDesFiltres,
  type LobbyingActionsParams,
  lobbyingActionsParamsOf,
  parseLobbyingActionsParams,
  TEXTES_VISES,
} from "./params.ts";

export type LobbyingActionsScreenProps = ScreenProps<LobbyingActionsPage>;

const TRIS = [
  { value: "dateDebut-desc", label: "Date (récentes d'abord)" },
  { value: "dateDebut-asc", label: "Date (anciennes d'abord)" },
  { value: "lobbyiste-asc", label: "Représentant (A → Z)" },
  { value: "lobbyiste-desc", label: "Représentant (Z → A)" },
];

const SANS_FILTRE: Partial<LobbyingActionsParams> = {
  cible: "",
  texteVise: "",
  secteurs: [],
  dateFrom: "",
  dateTo: "",
};

const jourCourt = (jour: string) => formatJour(`${jour}T12:00:00Z`);

/**
 * Toutes les actions de lobbying déclarées à la HATVP : recherche (objet, représentant, texte
 * visé), cible, texte visé, secteurs, période, tri et pagination en liens. L'état vit dans
 * l'URL avec les clés de apps/web. Remplace `app/lobbying/actions/page.tsx` de apps/web (le
 * défilement infini devient une pagination).
 */
export const LobbyingActionsScreen = ({
  params: rawParams,
  initialData,
}: LobbyingActionsScreenProps) => {
  const { navigate, pathname } = useNavigation();
  const params = parseLobbyingActionsParams(rawParams);
  const query = useApiQuery<LobbyingActionsPage>("/lobbying/actions", actionsQueryOf(params), {
    initialData,
  });
  const secteursQuery = useApiQuery<{ data: LobbyingSecteur[] }>("/lobbying/secteurs");
  const secteurs = (secteursQuery.data?.data ?? []).filter((secteur) => secteur.actionsCount > 0);
  const nomSecteur = (slug: string) => secteurs.find((item) => item.slug === slug)?.name ?? slug;

  const update = (patch: Partial<LobbyingActionsParams>) =>
    navigate(buildHref(pathname, lobbyingActionsParamsOf({ ...params, page: 1, ...patch })));
  const hrefFor = (page: number) =>
    buildHref(pathname, lobbyingActionsParamsOf({ ...params, page }));

  const texteVise = TEXTES_VISES.find((texte) => texte.value === params.texteVise);
  const actifs: ActiveFilter[] = [
    ...(params.cible
      ? [
          {
            id: `cible=${params.cible}`,
            label: `Cible : ${cibleLibelle(params.cible)}`,
            onRemove: () => update({ cible: "" }),
          },
        ]
      : []),
    ...(texteVise
      ? [
          {
            id: `texteVise=${texteVise.value}`,
            label: `Texte visé : ${texteVise.label}`,
            onRemove: () => update({ texteVise: "" }),
          },
        ]
      : []),
    ...params.secteurs.map((slug) => ({
      id: `secteurs=${slug}`,
      label: `Secteur : ${nomSecteur(slug)}`,
      onRemove: () => update({ secteurs: params.secteurs.filter((item) => item !== slug) }),
    })),
    ...(params.dateFrom || params.dateTo
      ? [
          {
            id: "periode",
            label: `Période${params.dateFrom ? ` du ${jourCourt(params.dateFrom)}` : ""}${
              params.dateTo ? ` au ${jourCourt(params.dateTo)}` : ""
            }`,
            onRemove: () => update({ dateFrom: "", dateTo: "" }),
          },
        ]
      : []),
  ];

  const page = query.data ? pageOf(query.data) : null;
  const filtre = aDesFiltres(params);

  return (
    <Container className={classes.page}>
      <PageHeader
        breadcrumb={[
          { label: "Accueil", href: "/" },
          { label: "Lobbying", href: "/lobbying" },
          { label: "Actions de lobbying" },
        ]}
        title="Actions de lobbying"
        description={
          <>
            <p className={classes.lead}>
              Toutes les actions de représentation d'intérêts déclarées à la Haute Autorité pour la
              transparence de la vie publique (HATVP).
            </p>
            <p className={classes.sources}>
              Source :{" "}
              <Link href="https://www.hatvp.fr/le-repertoire/" external>
                hatvp.fr
              </Link>{" "}
              · <Link href="/comprendre/lobbying">Comprendre le lobbying</Link>
            </p>
          </>
        }
      />

      <FilterBar
        label="Filtrer les actions"
        search={
          <SearchInput
            aria-label="Rechercher une action ou un représentant"
            placeholder="Rechercher une action, un représentant…"
            value={params.search}
            debounceMs={300}
            onChange={(search) => update({ search })}
          />
        }
        activeFilters={actifs}
        onReset={() => update(SANS_FILTRE)}
      >
        <NativeSelect
          label="Cible"
          value={params.cible}
          onChange={(event) => {
            const cible = event.currentTarget.value;
            update({ cible: LOBBYING_CIBLES.find((valeur) => valeur === cible) ?? "" });
          }}
          data={[
            { value: "", label: "Toutes les cibles" },
            ...LOBBYING_CIBLES.map((cible) => ({
              value: cible,
              label: LOBBYING_CIBLE_LIBELLES[cible],
            })),
          ]}
        />
        <NativeSelect
          label="Texte visé"
          value={params.texteVise}
          onChange={(event) => update({ texteVise: event.currentTarget.value })}
          data={[{ value: "", label: "Tous les textes" }, ...TEXTES_VISES]}
        />
        {secteurs.length > 0 ? (
          <MultiSelectFilter
            label="Secteurs"
            placeholder="Tous les secteurs"
            options={secteurs.map((secteur) => ({
              value: secteur.slug,
              label: secteur.name,
              count: secteur.actionsCount,
            }))}
            value={params.secteurs}
            onChange={(valeurs) => update({ secteurs: valeurs })}
            countLabel={(count) =>
              `${count} secteur${count > 1 ? "s" : ""} choisi${count > 1 ? "s" : ""}`
            }
          />
        ) : null}
        <SortSelect
          label="Trier par"
          value={`${params.sort}-${params.order}`}
          options={TRIS}
          onChange={(value) => {
            const [sort, order] = value.split("-");
            update({
              sort: sort === "lobbyiste" ? "lobbyiste" : "dateDebut",
              order: order === "asc" ? "asc" : "desc",
            });
          }}
        />
        <DateRangePicker
          label="Période"
          placeholder="Filtrer par période"
          value={{ from: params.dateFrom || null, to: params.dateTo || null }}
          onChange={({ from, to }) => update({ dateFrom: from ?? "", dateTo: to ?? "" })}
        />
      </FilterBar>

      <section aria-label="Résultats" className={classes.results}>
        {query.isPending ? (
          <LoadingState label="Chargement des actions…" variant="skeleton" lines={6} />
        ) : query.isError ? (
          <ErrorState
            message="Les actions n'ont pas pu être chargées. Vérifiez votre connexion puis réessayez."
            onRetry={() => query.refetch()}
          />
        ) : page && page.items.length > 0 ? (
          <>
            <p className={classes.count} aria-live="polite">
              {page.total.toLocaleString("fr-FR")} action{page.total > 1 ? "s" : ""} de lobbying
              {filtre ? " correspondant aux filtres" : ""}
            </p>
            <ul className={classes.list}>
              {page.items.map((action) => (
                <ActionLobbying
                  key={action.id}
                  action={action}
                  lobbyiste={action.lobbyiste}
                  titleAs="h2"
                  maxSecteurs={4}
                />
              ))}
            </ul>
            <Pagination
              page={page.page}
              total={page.totalPages}
              hrefFor={hrefFor}
              label="Pages d'actions de lobbying"
            />
          </>
        ) : (
          <EmptyState
            title="Aucune action trouvée"
            description={
              filtre
                ? "Aucune action ne correspond à ces critères. Modifiez ou retirez des filtres."
                : "Aucune action de lobbying n'est disponible pour le moment."
            }
            action={
              filtre ? (
                <Button variant="secondaire" onClick={() => update({ ...SANS_FILTRE, search: "" })}>
                  Effacer les filtres
                </Button>
              ) : undefined
            }
          />
        )}
      </section>
    </Container>
  );
};
