"use client";

import { useApiQuery } from "@clair/api-client";
import {
  LOBBYISTE_TYPE_LIBELLES,
  LOBBYISTE_TYPES,
  type LobbyingActionListItem,
  type LobbyingSecteur,
  type LobbyingStats,
  type LobbyistesPage,
  pageOf,
} from "@clair/data";
import {
  type ActiveFilter,
  Button,
  buildHref,
  Container,
  EmptyState,
  ErrorState,
  FilterBar,
  Link,
  LoadingState,
  MultiSelectFilter,
  PageHeader,
  Pagination,
  ProvenanceLabel,
  SearchInput,
  SectionHeader,
  SortSelect,
  StatCard,
  useNavigation,
} from "@clair/ui";
import { NativeSelect } from "@mantine/core";
import type { ScreenProps } from "../shared/types.ts";
import { ActionLobbying } from "./ActionLobbying.tsx";
import { formatBudget, typeLibelle } from "./format.ts";
import classes from "./LobbyingListeScreen.module.css";
import { LobbyisteItem } from "./LobbyisteItem.tsx";
import {
  aDesFiltres,
  type LobbyingListeParams,
  lobbyingListeParamsOf,
  lobbyistesQueryOf,
  type Ordre,
  parseLobbyingListeParams,
  TRIS_LOBBYISTES,
  type TriLobbyistes,
} from "./params.ts";

export type LobbyingListeScreenProps = ScreenProps<LobbyistesPage>;

const TRIS = [
  { value: "nom-asc", label: "Nom (A → Z)" },
  { value: "nom-desc", label: "Nom (Z → A)" },
  { value: "budget-desc", label: "Budget (décroissant)" },
  { value: "budget-asc", label: "Budget (croissant)" },
  { value: "actions-desc", label: "Nombre d'actions (décroissant)" },
  { value: "actions-asc", label: "Nombre d'actions (croissant)" },
];

const lireTri = (value: string): { sort: TriLobbyistes; order: Ordre } => {
  const [sort = "", order = ""] = value.split("-");
  const tri = TRIS_LOBBYISTES.find((item) => item === sort) ?? "nom";
  return { sort: tri, order: order === "desc" ? "desc" : "asc" };
};

const SANS_FILTRE: Partial<LobbyingListeParams> = { search: "", type: "", secteurs: [] };

/** Chiffres globaux du répertoire, masqués tant que l'API n'en a pas. */
const ChiffresLobbying = () => {
  const stats = useApiQuery<{ data: LobbyingStats }>("/lobbying/stats");
  const chiffres = stats.data?.data;
  if (!chiffres || chiffres.totalLobbyistes === 0) return null;
  return (
    <section aria-labelledby="lobbying-chiffres" className={classes.section}>
      <h2 id="lobbying-chiffres" className="clair-visually-hidden">
        Chiffres clés
      </h2>
      <ul className={classes.stats}>
        <StatCard
          as="li"
          label="Représentants d'intérêts"
          value={chiffres.totalLobbyistes.toLocaleString("fr-FR")}
          help="Organisations inscrites au répertoire de la HATVP."
        />
        <StatCard
          as="li"
          label="Actions déclarées"
          value={chiffres.totalActions.toLocaleString("fr-FR")}
          help="Chaque rencontre ou communication déclarée, par exercice."
        />
        <StatCard
          as="li"
          label="Budget total déclaré"
          value={formatBudget(chiffres.budgetTotal)}
          help="Somme des budgets annuels déclarés, par tranches : un ordre de grandeur."
        />
        <StatCard
          as="li"
          label="Secteurs d'activité"
          value={chiffres.totalSecteurs.toLocaleString("fr-FR")}
          help="Secteurs distincts déclarés par les représentants d'intérêts."
        />
      </ul>
      <ProvenanceLabel
        provenance="calculee"
        source="HATVP"
        methodologyHref="/methodologie#hatvp"
        size="sm"
      />
    </section>
  );
};

/** Les trois dernières actions déclarées, avec un lien vers toutes les actions. */
const DernieresActions = () => {
  const recentes = useApiQuery<{ data: LobbyingActionListItem[] }>("/lobbying/actions/recent", {
    limit: 3,
  });
  const actions = recentes.data?.data ?? [];
  if (actions.length === 0) return null;
  return (
    <section aria-labelledby="lobbying-recentes" className={classes.section}>
      <SectionHeader
        id="lobbying-recentes"
        title="Dernières actions déclarées"
        seeAllHref="/lobbying/actions"
        seeAllLabel="Voir toutes les actions"
      />
      <ul className={classes.recentes}>
        {actions.map((action) => (
          <ActionLobbying key={action.id} action={action} lobbyiste={action.lobbyiste} />
        ))}
      </ul>
    </section>
  );
};

/**
 * Lobbying : chiffres du répertoire de la HATVP, dernières actions déclarées et liste des
 * représentants d'intérêts (recherche, type, secteurs, tri, pagination en liens). L'état vit
 * dans l'URL avec les clés de apps/web (`search`, `type`, `secteurs`, `sort`, `order`, `page`).
 * Remplace `app/lobbying/PageClient.tsx` de apps/web (le défilement infini devient une
 * pagination).
 */
export const LobbyingListeScreen = ({
  params: rawParams,
  initialData,
}: LobbyingListeScreenProps) => {
  const { navigate, pathname } = useNavigation();
  const params = parseLobbyingListeParams(rawParams);
  const query = useApiQuery<LobbyistesPage>("/lobbying", lobbyistesQueryOf(params), {
    initialData,
  });
  const secteursQuery = useApiQuery<{ data: LobbyingSecteur[] }>("/lobbying/secteurs");
  const secteurs = (secteursQuery.data?.data ?? []).filter(
    (secteur) => secteur.lobbyistesCount > 0,
  );
  const nomSecteur = (slug: string) => secteurs.find((item) => item.slug === slug)?.name ?? slug;

  const update = (patch: Partial<LobbyingListeParams>) =>
    navigate(buildHref(pathname, lobbyingListeParamsOf({ ...params, page: 1, ...patch })));
  const hrefFor = (page: number) => buildHref(pathname, lobbyingListeParamsOf({ ...params, page }));

  const actifs: ActiveFilter[] = [
    ...(params.type
      ? [
          {
            id: `type=${params.type}`,
            label: `Type : ${typeLibelle(params.type)}`,
            onRemove: () => update({ type: "" }),
          },
        ]
      : []),
    ...params.secteurs.map((slug) => ({
      id: `secteurs=${slug}`,
      label: `Secteur : ${nomSecteur(slug)}`,
      onRemove: () => update({ secteurs: params.secteurs.filter((item) => item !== slug) }),
    })),
  ];

  const page = query.data ? pageOf(query.data) : null;
  const filtre = aDesFiltres(params);

  return (
    <Container className={classes.page}>
      <PageHeader
        breadcrumb={[{ label: "Accueil", href: "/" }, { label: "Lobbying" }]}
        title="Lobbying"
        description={
          <>
            <p className={classes.lead}>
              Représentants d'intérêts inscrits au répertoire de la Haute Autorité pour la
              transparence de la vie publique (HATVP), et les actions qu'ils déclarent.
            </p>
            <p className={classes.sources}>
              Source :{" "}
              <Link href="https://www.hatvp.fr/le-repertoire/" external>
                hatvp.fr
              </Link>{" "}
              · <Link href="/methodologie#hatvp">Méthodologie</Link> ·{" "}
              <Link href="/comprendre/lobbying">Comprendre le lobbying</Link> ·{" "}
              <Link href="/guide/comprendre-le-lobbying">Guide</Link>
            </p>
          </>
        }
      />

      <ChiffresLobbying />
      <DernieresActions />

      <section aria-labelledby="lobbying-representants" className={classes.section}>
        <SectionHeader id="lobbying-representants" title="Représentants d'intérêts" />
        <FilterBar
          label="Filtrer les représentants d'intérêts"
          search={
            <SearchInput
              aria-label="Rechercher un représentant d'intérêts"
              placeholder="Rechercher par nom…"
              value={params.search}
              debounceMs={300}
              onChange={(search) => update({ search })}
            />
          }
          activeFilters={actifs}
          onReset={() => update({ type: "", secteurs: [] })}
        >
          <NativeSelect
            label="Type"
            value={params.type}
            onChange={(event) => {
              const type = event.currentTarget.value;
              update({ type: LOBBYISTE_TYPES.find((valeur) => valeur === type) ?? "" });
            }}
            data={[
              { value: "", label: "Tous les types" },
              ...LOBBYISTE_TYPES.map((type) => ({
                value: type,
                label: LOBBYISTE_TYPE_LIBELLES[type],
              })),
            ]}
          />
          {secteurs.length > 0 ? (
            <MultiSelectFilter
              label="Secteurs"
              placeholder="Tous les secteurs"
              options={secteurs.map((secteur) => ({
                value: secteur.slug,
                label: secteur.name,
                count: secteur.lobbyistesCount,
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
            onChange={(value) => update(lireTri(value))}
          />
        </FilterBar>

        <div className={classes.results}>
          {query.isPending ? (
            <LoadingState
              label="Chargement des représentants d'intérêts…"
              variant="skeleton"
              lines={6}
            />
          ) : query.isError ? (
            <ErrorState
              message="La liste n'a pas pu être chargée. Vérifiez votre connexion puis réessayez."
              onRetry={() => query.refetch()}
            />
          ) : page && page.items.length > 0 ? (
            <>
              <p className={classes.count} aria-live="polite">
                {page.total.toLocaleString("fr-FR")} représentant{page.total > 1 ? "s" : ""}{" "}
                d'intérêts{filtre ? " correspondant aux filtres" : ""}
              </p>
              <ul className={classes.list}>
                {page.items.map((lobbyiste) => (
                  <LobbyisteItem key={lobbyiste.id} lobbyiste={lobbyiste} />
                ))}
              </ul>
              <Pagination
                page={page.page}
                total={page.totalPages}
                hrefFor={hrefFor}
                label="Pages de représentants d'intérêts"
              />
            </>
          ) : (
            <EmptyState
              title="Aucun représentant d'intérêts trouvé"
              description={
                filtre
                  ? "Aucun représentant ne correspond à ces critères. Modifiez ou retirez des filtres."
                  : "Le répertoire n'est pas encore disponible."
              }
              action={
                filtre ? (
                  <Button variant="secondaire" onClick={() => update(SANS_FILTRE)}>
                    Effacer les filtres
                  </Button>
                ) : undefined
              }
            />
          )}
        </div>
      </section>
    </Container>
  );
};
