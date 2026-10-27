"use client";

import { useApiQuery } from "@clair/api-client";
import type { SearchAllResponse, SearchCounts, SearchPageResponse } from "@clair/data";
import {
  Button,
  buildHref,
  Container,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SearchInput,
  useNavigation,
} from "@clair/ui";
import { Switch } from "@mantine/core";
import { ChevronRight, Search } from "lucide-react";
import { useState } from "react";
import type { ScreenProps } from "../shared/types.ts";
import {
  CATEGORIES,
  type FiltreRecherche,
  LONGUEUR_MIN,
  parseRechercheParams,
  type RechercheParams,
  rechercheParamsOf,
  rechercheValide,
  searchQueryOf,
} from "./params.ts";
import classes from "./RechercheScreen.module.css";
import { ResultatCard } from "./ResultatCard.tsx";
import { CATEGORIE, cleDe } from "./resultats.ts";

/** Réponse de `/search` : aperçu de toutes les catégories, ou une catégorie paginée. */
export type RechercheReponse = SearchAllResponse | SearchPageResponse;

export type RechercheScreenProps = ScreenProps<RechercheReponse>;

const nombre = (n: number) => n.toLocaleString("fr-FR");

const AucunResultat = () => (
  <EmptyState
    icon={<Search />}
    title="Aucun résultat trouvé"
    description="Essayez avec d'autres termes"
  />
);

/** Données de la route, reprises seulement si elles répondent à la recherche affichée. */
const initialPour = (params: RechercheParams, initialData?: RechercheReponse) => {
  if (!initialData || initialData.meta.query !== params.q) return undefined;
  if (initialData.meta.inclureAnciens !== params.anciens) return undefined;
  const type = "sections" in initialData ? "all" : initialData.meta.type;
  if (type !== params.type) return undefined;
  return "sections" in initialData || initialData.meta.page === 1 ? initialData : undefined;
};

/** Aperçu : cinq résultats au plus par catégorie, et l'accès à tous ceux d'une catégorie. */
const Apercu = ({
  data,
  onVoirTout,
}: {
  data: SearchAllResponse;
  onVoirTout: (type: FiltreRecherche) => void;
}) => {
  if (data.meta.counts.total === 0) return <AucunResultat />;
  return (
    <div className={classes.sections}>
      {CATEGORIES.map((categorie) => {
        const resultats = data.sections[categorie] ?? [];
        if (resultats.length === 0) return null;
        const { pluriel, icone: Icone } = CATEGORIE[categorie];
        const total = data.meta.counts[categorie];
        const id = `recherche-${categorie}`;
        return (
          <section key={categorie} aria-labelledby={id} className={classes.section}>
            <div className={classes.sectionEntete}>
              <h2 id={id} className={classes.sectionTitre}>
                <span className={classes.sectionIcone} aria-hidden="true">
                  <Icone />
                </span>
                {pluriel}
                <span className={classes.compte}>({nombre(total)})</span>
              </h2>
              {total > resultats.length ? (
                <Button
                  variant="tertiaire"
                  size="sm"
                  icon={<ChevronRight />}
                  iconPosition="end"
                  onClick={() => onVoirTout(categorie)}
                >
                  Voir les {nombre(total)} résultats
                  <span className="clair-visually-hidden"> : {pluriel}</span>
                </Button>
              ) : null}
            </div>
            <ul className={classes.liste}>
              {resultats.map((resultat) => (
                <ResultatCard key={cleDe(resultat)} resultat={resultat} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
};

/** Résultats d'une page suivante, lus dans le cache de requêtes (chargés par la liste). */
const PageSuivante = ({ params, page }: { params: RechercheParams; page: number }) => {
  const { data } = useApiQuery<SearchPageResponse>("/search", searchQueryOf(params, page));
  return data
    ? data.data.map((resultat) => (
        <ResultatCard key={cleDe(resultat)} resultat={resultat} titleAs="h2" />
      ))
    : null;
};

/**
 * Une catégorie : trente résultats, puis les suivants à la demande (bouton plutôt que
 * défilement infini : la fin de page reste atteignable, au clavier comme à la souris).
 */
const ResultatsFiltres = ({
  params,
  premiere,
}: {
  params: RechercheParams;
  premiere: SearchPageResponse;
}) => {
  const [pages, setPages] = useState(1);
  const derniere = useApiQuery<SearchPageResponse>("/search", searchQueryOf(params, pages), {
    enabled: pages > 1,
  });

  if (premiere.data.length === 0) return <AucunResultat />;

  const suivantes = Array.from({ length: pages - 1 }, (_, index) => index + 2);
  const meta = pages === 1 ? premiere.meta : derniere.data?.meta;
  // Les pages précédant la dernière sont pleines (l'API pagine par `limit`).
  const affiches = Math.min(
    pages === 1
      ? premiere.data.length
      : (pages - 1) * premiere.meta.limit + (derniere.data?.data.length ?? 0),
    premiere.meta.total,
  );

  return (
    <>
      <p className={classes.statut} aria-live="polite">
        {nombre(affiches)} résultat{affiches > 1 ? "s" : ""} affiché{affiches > 1 ? "s" : ""} sur{" "}
        {nombre(premiere.meta.total)}
      </p>
      <ul className={classes.liste}>
        {premiere.data.map((resultat) => (
          <ResultatCard key={cleDe(resultat)} resultat={resultat} titleAs="h2" />
        ))}
        {suivantes.map((page) => (
          <PageSuivante key={page} params={params} page={page} />
        ))}
      </ul>
      <div className={classes.suite}>
        {pages > 1 && derniere.isPending ? (
          <LoadingState label="Chargement des résultats suivants…" />
        ) : pages > 1 && derniere.isError ? (
          <ErrorState
            message="Les résultats suivants n'ont pas pu être chargés."
            onRetry={() => void derniere.refetch()}
          />
        ) : meta?.hasNext ? (
          <Button variant="secondaire" onClick={() => setPages(pages + 1)}>
            Afficher plus de résultats
          </Button>
        ) : (
          <p className={classes.fin}>Tous les résultats ont été chargés</p>
        )}
      </div>
    </>
  );
};

const FILTRES: { valeur: FiltreRecherche; label: string }[] = [
  { valeur: "all", label: "Tout" },
  ...CATEGORIES.map((categorie) => ({ valeur: categorie, label: CATEGORIE[categorie].pluriel })),
];

const compteDe = (counts: SearchCounts | undefined, filtre: FiltreRecherche) =>
  counts === undefined ? undefined : filtre === "all" ? counts.total : counts[filtre];

/**
 * Recherche globale : parlementaires (en exercice, et anciens sur demande), groupes,
 * commissions, scrutins, sujets, lobbyistes et dossiers. Le terme (`q`), la catégorie (`type`)
 * et l'inclusion des mandats clos (`anciens=1`) vivent dans l'URL. Remplace
 * `app/recherche/page.tsx` de apps/web.
 */
export const RechercheScreen = ({ params: rawParams, initialData }: RechercheScreenProps) => {
  const { navigate, pathname } = useNavigation();
  const params = parseRechercheParams(rawParams);
  const valide = rechercheValide(params);
  const { data, isPending, isError, refetch } = useApiQuery<RechercheReponse>(
    "/search",
    searchQueryOf(params),
    { initialData: initialPour(params, initialData), enabled: valide },
  );

  const update = (patch: Partial<RechercheParams>) =>
    navigate(buildHref(pathname, rechercheParamsOf({ ...params, ...patch })));

  const counts = valide ? data?.meta.counts : undefined;
  const anciensDisponibles = data?.meta.anciensDisponibles ?? 0;

  const contenu = () => {
    if (!params.q) {
      return (
        <EmptyState
          icon={<Search />}
          title="Commencez à taper pour rechercher"
          description={`Minimum ${LONGUEUR_MIN} caractères`}
        />
      );
    }
    if (!valide) return <EmptyState title={`Minimum ${LONGUEUR_MIN} caractères requis`} />;
    if (isPending) return <LoadingState label="Recherche en cours…" variant="skeleton" />;
    if (isError) {
      return (
        <ErrorState
          message="Une erreur est survenue lors de la recherche. Vérifiez votre connexion puis réessayez."
          onRetry={() => void refetch()}
        />
      );
    }
    if ("sections" in data) return <Apercu data={data} onVoirTout={(type) => update({ type })} />;
    return (
      <ResultatsFiltres
        key={`${params.q}|${params.type}|${params.anciens}`}
        params={params}
        premiere={data}
      />
    );
  };

  return (
    <Container className={classes.page}>
      <PageHeader
        title="Recherche"
        breadcrumb={[{ label: "Accueil", href: "/" }, { label: "Recherche" }]}
        description="Trouvez des parlementaires, groupes, commissions, scrutins, sujets, lobbyistes et dossiers"
      />

      <div className={classes.outils}>
        <search className={classes.champ}>
          <SearchInput
            aria-label="Rechercher sur CLAIR"
            placeholder="Rechercher…"
            value={params.q}
            debounceMs={300}
            onChange={(q) => update({ q })}
          />
        </search>

        {valide ? (
          <div className={classes.anciens}>
            <Switch
              label="Inclure les anciens parlementaires et commissions"
              checked={params.anciens}
              onChange={(event) => update({ anciens: event.currentTarget.checked })}
            />
            {!params.anciens && anciensDisponibles > 0 ? (
              <Button variant="tertiaire" size="sm" onClick={() => update({ anciens: true })}>
                {anciensDisponibles > 1
                  ? `${nombre(anciensDisponibles)} résultats archivés correspondent aussi`
                  : "1 résultat archivé correspond aussi"}
              </Button>
            ) : null}
          </div>
        ) : null}

        <fieldset className={classes.groupe}>
          <legend className="clair-visually-hidden">Type de résultat</legend>
          <div className={classes.filtres}>
            {FILTRES.map(({ valeur, label }) => {
              const compte = compteDe(counts, valeur);
              return (
                <button
                  key={valeur}
                  type="button"
                  className={classes.filtre}
                  aria-pressed={params.type === valeur}
                  onClick={() => update({ type: valeur })}
                >
                  {label}
                  {compte !== undefined ? (
                    <span className={classes.filtreCompte}> ({nombre(compte)})</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      <div className={classes.resultats}>{contenu()}</div>
    </Container>
  );
};
