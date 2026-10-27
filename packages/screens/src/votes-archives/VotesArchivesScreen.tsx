"use client";

import { useApiQuery } from "@clair/api-client";
import { type AnneeScrutins, type PageMeta, pageOf, type ScrutinListItem } from "@clair/data";
import {
  type BreadcrumbItem,
  buildHref,
  Card,
  Container,
  EmptyState,
  ErrorState,
  Link,
  LoadingState,
  PageHeader,
  Pagination,
  ScrutinCard,
  useNavigation,
} from "@clair/ui";
import { periodeScrutin, pluriel, scrutinHref } from "../shared/scrutins.ts";
import type { ScreenProps } from "../shared/types.ts";
import {
  archiveHref,
  archivesQueryOf,
  libellePeriode,
  MOIS,
  moisVoisins,
  type PeriodeArchive,
  parseVotesArchivesParams,
  votesArchivesParamsOf,
} from "./params.ts";
import classes from "./VotesArchivesScreen.module.css";

/** Données chargées par la route : les années (index) ou la page de scrutins de la période. */
export type VotesArchivesInitial = {
  annees?: { data: AnneeScrutins[] };
  scrutins?: PageMeta<ScrutinListItem>;
};

export type VotesArchivesScreenProps = ScreenProps<VotesArchivesInitial> & {
  /** Période affichée ; `null` pour l'index des années (`/votes`). */
  periode: PeriodeArchive | null;
};

const majuscule = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1);

/** Index des archives : une entrée par année, avec son nombre de scrutins. */
const Annees = ({ initialData }: { initialData?: { data: AnneeScrutins[] } }) => {
  const query = useApiQuery<{ data: AnneeScrutins[] }>("/scrutins/annees", {}, { initialData });
  if (query.isPending) return <LoadingState label="Chargement des années…" />;
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />;
  if (query.data.data.length === 0) return <EmptyState title="Aucune donnée disponible" />;
  return (
    <ul className={classes.annees}>
      {query.data.data.map(({ year, count }) => (
        <Card key={year} as="li" titleAs="h2" href={`/votes/${year}`} title={String(year)}>
          <p className={classes.mention}>{pluriel(count, "scrutin")}</p>
        </Card>
      ))}
    </ul>
  );
};

/** Scrutins d'une année ou d'un mois, paginés en liens. */
const Scrutins = ({
  periode,
  page,
  initialData,
}: {
  periode: PeriodeArchive;
  page: number;
  initialData?: PageMeta<ScrutinListItem>;
}) => {
  const { pathname } = useNavigation();
  const query = useApiQuery<PageMeta<ScrutinListItem>>(
    "/scrutins",
    archivesQueryOf(periode, { page }),
    { initialData },
  );
  if (query.isPending) {
    return <LoadingState label="Chargement des scrutins…" variant="skeleton" lines={6} />;
  }
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />;
  const resultats = pageOf(query.data);
  return (
    <>
      <p className={classes.mention} aria-live="polite">
        {resultats.total > 0
          ? `${pluriel(resultats.total, "scrutin public", "scrutins publics")}`
          : "Aucun scrutin"}{" "}
        en {libellePeriode(periode)}. <Link href="/scrutins">Voir tous les scrutins</Link>.
      </p>
      {resultats.items.length > 0 ? (
        <ul className={classes.liste}>
          {resultats.items.map((scrutin) => (
            <ScrutinCard
              key={scrutin.id}
              as="li"
              titleAs="h2"
              scrutin={{ ...scrutin, titre: majuscule(scrutin.titre) }}
              href={scrutinHref(scrutin)}
              periode={periodeScrutin(scrutin)}
            />
          ))}
        </ul>
      ) : (
        <EmptyState
          title="Aucun scrutin sur cette période"
          description="Les archives ne contiennent aucun vote public pour cette période."
        />
      )}
      <Pagination
        page={resultats.page}
        total={resultats.totalPages}
        hrefFor={(cible) => buildHref(pathname, votesArchivesParamsOf({ page: cible }))}
        label="Pages des archives"
      />
    </>
  );
};

/**
 * Archives des scrutins publics des deux chambres : index des années (`/votes`), scrutins d'une
 * année (`/votes/2025`) avec l'accès à ses mois, ou d'un mois (`/votes/2025/03`) avec le mois
 * précédent et le suivant. Paginées en liens (`?page=`), comme apps/web.
 */
export const VotesArchivesScreen = ({
  periode,
  params: rawParams,
  initialData,
}: VotesArchivesScreenProps) => {
  const { page } = parseVotesArchivesParams(rawParams);

  if (periode === null) {
    return (
      <Container className={classes.page}>
        <PageHeader
          breadcrumb={[
            { label: "Accueil", href: "/" },
            { label: "Scrutins", href: "/scrutins" },
            { label: "Archives des votes" },
          ]}
          title="Archives des votes parlementaires"
          description={
            <p className={classes.lead}>
              Tous les scrutins publics de l'Assemblée nationale et du Sénat, classés par année.{" "}
              <Link href="/scrutins">Utiliser la recherche et les filtres</Link>.
            </p>
          }
        />
        <Annees initialData={initialData?.annees} />
      </Container>
    );
  }

  const { annee, mois } = periode;
  const libelle = majuscule(libellePeriode(periode));
  const breadcrumb: BreadcrumbItem[] = [
    { label: "Accueil", href: "/" },
    { label: "Archives des votes", href: "/votes" },
    ...(mois === null
      ? [{ label: `Votes ${annee}` }]
      : [{ label: `Votes ${annee}`, href: `/votes/${annee}` }, { label: libelle }]),
  ];
  const voisins = mois === null ? null : moisVoisins(annee, mois);

  return (
    <Container className={classes.page}>
      <PageHeader
        breadcrumb={breadcrumb}
        title={`Votes ${libelle} — Assemblée nationale et Sénat`}
      />

      {mois === null ? (
        <nav aria-label="Mois de l'année" className={classes.navMois}>
          <ul className={classes.mois}>
            {MOIS.map((nom, index) => (
              <li key={nom}>
                <Link href={archiveHref({ annee, mois: index + 1 })}>{majuscule(nom)}</Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <section aria-label="Scrutins de la période" className={classes.resultats}>
        <Scrutins periode={periode} page={page} initialData={initialData?.scrutins} />
      </section>

      {voisins ? (
        <nav aria-label="Navigation entre les mois" className={classes.voisins}>
          {voisins.precedent ? (
            <Link href={archiveHref(voisins.precedent)}>
              <span aria-hidden="true">← </span>
              {majuscule(libellePeriode(voisins.precedent))}
            </Link>
          ) : (
            <span />
          )}
          {voisins.suivant ? (
            <Link href={archiveHref(voisins.suivant)}>
              {majuscule(libellePeriode(voisins.suivant))}
              <span aria-hidden="true"> →</span>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}

      <p className={classes.pied}>
        {mois !== null ? (
          <>
            <Link href={`/votes/${annee}`}>Tous les votes de {annee}</Link> ·{" "}
          </>
        ) : null}
        <Link href="/scrutins">Explorer tous les scrutins (recherche et filtres)</Link>
      </p>
    </Container>
  );
};
