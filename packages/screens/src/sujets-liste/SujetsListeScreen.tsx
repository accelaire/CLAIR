"use client";

import { useApiQuery } from "@clair/api-client";
import type { PageMeta, SujetListItem } from "@clair/data";
import {
  buildHref,
  Container,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SearchInput,
  useNavigation,
} from "@clair/ui";
import type { ScreenProps } from "../shared/types.ts";
import { parseSujetsListeParams, sujetsListeParamsOf } from "./params.ts";
import classes from "./SujetsListeScreen.module.css";
import { SujetsSections } from "./SujetsSections.tsx";

/** L'API sert au plus 100 sujets par page ; la liste les rassemble tous (moins de 700). */
const PAR_PAGE = 100;
/** Garde-fou contre une réponse aberrante qui ferait boucler le chargement. */
const PAGES_MAX = 20;

/** Pages de `/sujets` chargées par la route (vue sans recherche). */
export type SujetsListeInitial = PageMeta<SujetListItem>[];

export type SujetsListeScreenProps = ScreenProps<SujetsListeInitial> & {
  /** Instant du rendu serveur (ms), passé par la route. */
  maintenant?: number;
};

type ChargeurProps = {
  page: number;
  search: string;
  precedents: SujetListItem[];
  initialData?: SujetsListeInitial;
  maintenant?: number;
};

/**
 * Charge une page de sujets, puis la suivante tant qu'il en reste : chaque page est une requête
 * mise en cache (`useApiQuery`), et la dernière affiche l'ensemble.
 */
const ChargeurSujets = ({ page, search, precedents, initialData, maintenant }: ChargeurProps) => {
  const { data, isPending, isError, refetch } = useApiQuery<PageMeta<SujetListItem>>(
    "/sujets",
    { page, limit: PAR_PAGE, search: search || undefined },
    { initialData: search ? undefined : initialData?.[page - 1] },
  );

  if (isPending) return <LoadingState label="Chargement des sujets…" variant="skeleton" />;
  if (isError) {
    return (
      <ErrorState
        message="Les sujets n'ont pas pu être chargés. Vérifiez votre connexion puis réessayez."
        onRetry={() => void refetch()}
      />
    );
  }

  const sujets = [...precedents, ...data.data];
  if (data.meta.hasNext && page < PAGES_MAX) {
    return (
      <ChargeurSujets
        page={page + 1}
        search={search}
        precedents={sujets}
        initialData={initialData}
        maintenant={maintenant}
      />
    );
  }

  if (sujets.length === 0) {
    return (
      <EmptyState
        title="Aucun sujet trouvé"
        description={
          search
            ? "Essayez de modifier votre recherche."
            : "Aucun sujet n'est encore suivi. Les grands textes apparaîtront ici dès leur dépôt."
        }
      />
    );
  }

  return <SujetsSections sujets={sujets} recherche={search !== ""} maintenant={maintenant} />;
};

/**
 * Liste des sujets : chaque grand texte de loi suivi de son dépôt à son issue. Recherche dans
 * l'URL (`?search=`), sujet « À la une », récemment promulgués, puis sections par issue.
 * Remplace `app/sujets/PageClient.tsx` de apps/web.
 */
export const SujetsListeScreen = ({ params, initialData, maintenant }: SujetsListeScreenProps) => {
  const { navigate, pathname } = useNavigation();
  const { search } = parseSujetsListeParams(params);
  const total =
    !search && initialData
      ? initialData.reduce((somme, page) => somme + page.data.length, 0)
      : null;

  return (
    <Container className={classes.page}>
      <PageHeader
        title="Sujets parlementaires"
        breadcrumb={[{ label: "Accueil", href: "/" }, { label: "Sujets" }]}
        description={`${
          total ? `${total.toLocaleString("fr-FR")} grands textes` : "Les grands textes"
        } de loi suivis de bout en bout, du dépôt au vote final, côté Assemblée comme côté Sénat.`}
      />

      <div className={classes.search}>
        <SearchInput
          label="Rechercher un sujet"
          placeholder="Par exemple : logement"
          value={search}
          debounceMs={300}
          onChange={(value) =>
            navigate(buildHref(pathname, sujetsListeParamsOf({ search: value })))
          }
        />
      </div>

      <ChargeurSujets
        page={1}
        search={search}
        precedents={[]}
        initialData={initialData}
        maintenant={maintenant}
      />
    </Container>
  );
};
