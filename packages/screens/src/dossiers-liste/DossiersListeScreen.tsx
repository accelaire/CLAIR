"use client";

import { useApiQuery } from "@clair/api-client";
import { type DossierListItem, type DossiersFilters, type PageMeta, pageOf } from "@clair/data";
import {
  type ActiveFilter,
  Button,
  buildHref,
  ChambreSwitch,
  Container,
  DateRangePicker,
  DossierCard,
  EmptyState,
  ErrorState,
  FilterBar,
  Link,
  LoadingState,
  PageHeader,
  Pagination,
  SearchInput,
  STATUTS,
  useNavigation,
} from "@clair/ui";
import { NativeSelect } from "@mantine/core";
import type { ScreenProps } from "../shared/types.ts";
import classes from "./DossiersListeScreen.module.css";
import {
  aDesFiltres,
  type DossiersListeParams,
  dossiersListeParamsOf,
  dossiersQueryOf,
  ETATS_FILTRABLES,
  parseDossiersListeParams,
} from "./params.ts";

export type DossiersListeScreenProps = ScreenProps<PageMeta<DossierListItem>>;

const CHAMBRE_LIBELLE = { assemblee: "Assemblée nationale", senat: "Sénat" } as const;

const SANS_FILTRE: Partial<DossiersListeParams> = {
  etat: "",
  chambre: "",
  procedureCode: "",
  procedureLibelle: "",
  dateFrom: "",
  dateTo: "",
};

const formatJour = (jour: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${jour}T12:00:00`),
  );

/**
 * Liste des dossiers législatifs (ceux qui ont au moins un scrutin) : recherche, filtres
 * (chambre, état, procédure, période de dépôt) et pagination en liens. Tout l'état vit dans
 * l'URL, avec les mêmes clés que apps/web (`search`, `etat`, `chambre`, `procedureLibelle`,
 * `dateFrom`, `dateTo`, `page`).
 */
export const DossiersListeScreen = ({
  params: rawParams,
  initialData,
}: DossiersListeScreenProps) => {
  const { navigate, pathname } = useNavigation();
  const params = parseDossiersListeParams(rawParams);
  const query = useApiQuery<PageMeta<DossierListItem>>("/dossiers", dossiersQueryOf(params), {
    initialData,
  });
  const filters = useApiQuery<DossiersFilters>("/dossiers/filters");
  const procedures = filters.data?.procedures ?? [];

  /** Nouveau filtre : retour en page 1. */
  const update = (patch: Partial<DossiersListeParams>) =>
    navigate(buildHref(pathname, dossiersListeParamsOf({ ...params, page: 1, ...patch })));
  const hrefFor = (page: number) => buildHref(pathname, dossiersListeParamsOf({ ...params, page }));

  const actifs: ActiveFilter[] = [
    params.chambre
      ? {
          id: `chambre=${params.chambre}`,
          label: `Chambre : ${CHAMBRE_LIBELLE[params.chambre]}`,
          onRemove: () => update({ chambre: "" }),
        }
      : null,
    params.etat
      ? {
          id: `etat=${params.etat}`,
          label: `État : ${STATUTS[params.etat].label}`,
          onRemove: () => update({ etat: "" }),
        }
      : null,
    params.procedureLibelle
      ? {
          id: `procedureLibelle=${params.procedureLibelle}`,
          label: `Procédure : ${params.procedureLibelle}`,
          onRemove: () => update({ procedureLibelle: "" }),
        }
      : null,
    params.procedureCode
      ? {
          id: `procedureCode=${params.procedureCode}`,
          label: `Code de procédure : ${params.procedureCode}`,
          onRemove: () => update({ procedureCode: "" }),
        }
      : null,
    params.dateFrom || params.dateTo
      ? {
          id: "periode",
          label: `Déposés ${params.dateFrom ? `du ${formatJour(params.dateFrom)}` : ""}${
            params.dateTo ? ` au ${formatJour(params.dateTo)}` : ""
          }`,
          onRemove: () => update({ dateFrom: "", dateTo: "" }),
        }
      : null,
  ].filter((filtre): filtre is ActiveFilter => filtre !== null);

  /** Retire les filtres ; la recherche saisie est conservée. */
  const reset = () => update(SANS_FILTRE);

  const page = query.data ? pageOf(query.data) : null;

  return (
    <Container className={classes.page}>
      <PageHeader
        breadcrumb={[{ label: "Accueil", href: "/" }, { label: "Dossiers législatifs" }]}
        title="Dossiers législatifs"
        description={
          <>
            <p className={classes.lead}>
              {page && page.total > 0 ? (
                <>
                  <span className="clair-chiffres">{page.total.toLocaleString("fr-FR")}</span>{" "}
                  dossiers avec des scrutins associés
                </>
              ) : (
                "Les projets et propositions de loi de l'Assemblée nationale et du Sénat qui ont fait l'objet d'un scrutin public."
              )}
            </p>
            <p className={classes.sources}>
              Sources :{" "}
              <Link href="https://data.assemblee-nationale.fr" external>
                data.assemblee-nationale.fr
              </Link>
              ,{" "}
              <Link href="https://data.senat.fr" external>
                data.senat.fr
              </Link>{" "}
              ·{" "}
              <Link href="/comprendre/dossier-legislatif">
                Comment fonctionne un dossier législatif ?
              </Link>
            </p>
          </>
        }
      />

      <FilterBar
        label="Filtrer les dossiers"
        search={
          <SearchInput
            aria-label="Rechercher un dossier"
            placeholder="Rechercher un dossier…"
            value={params.search}
            debounceMs={300}
            onChange={(search) => update({ search })}
          />
        }
        activeFilters={actifs}
        onReset={reset}
      >
        <ChambreSwitch value={params.chambre} onChange={(chambre) => update({ chambre })} compact />
        <NativeSelect
          label="État"
          value={params.etat}
          onChange={(event) => {
            const etat = event.currentTarget.value;
            update({ etat: ETATS_FILTRABLES.find((valeur) => valeur === etat) ?? "" });
          }}
          data={[
            { value: "", label: "Tous les états" },
            ...ETATS_FILTRABLES.map((etat) => ({ value: etat, label: STATUTS[etat].label })),
          ]}
        />
        {procedures.length > 0 ? (
          <NativeSelect
            label="Procédure"
            className={classes.procedure}
            value={params.procedureLibelle}
            onChange={(event) => update({ procedureLibelle: event.currentTarget.value })}
            data={[
              { value: "", label: "Toutes les procédures" },
              ...procedures.map((procedure) => ({
                value: procedure.label,
                label: `${procedure.label} (${procedure.count.toLocaleString("fr-FR")})`,
              })),
            ]}
          />
        ) : null}
        <DateRangePicker
          label="Date de dépôt"
          value={{ from: params.dateFrom || null, to: params.dateTo || null }}
          onChange={({ from, to }) => update({ dateFrom: from ?? "", dateTo: to ?? "" })}
        />
      </FilterBar>

      <section aria-label="Résultats" className={classes.results}>
        {query.isPending ? (
          <LoadingState label="Chargement des dossiers…" variant="skeleton" lines={6} />
        ) : query.isError ? (
          <ErrorState
            message="Les dossiers n'ont pas pu être chargés. Vérifiez votre connexion puis réessayez."
            onRetry={() => query.refetch()}
          />
        ) : page && page.items.length > 0 ? (
          <>
            <p className={classes.count} aria-live="polite">
              {page.total.toLocaleString("fr-FR")} dossier{page.total > 1 ? "s" : ""}
              {aDesFiltres(params) ? " correspondant aux filtres" : ""}
            </p>
            <ul className={classes.list}>
              {page.items.map((dossier) => (
                <DossierCard
                  key={dossier.id}
                  as="li"
                  titleAs="h2"
                  href={`/dossiers/${encodeURIComponent(dossier.uid)}`}
                  dossier={{
                    titre: dossier.titre,
                    procedureLibelle: dossier.procedureLibelle,
                    etat: dossier.etat,
                    chambre: dossier.chambre,
                    dateDepot: dossier.dateDepot,
                    lastScrutinDate: dossier.lastScrutinDate,
                    nbScrutins: dossier._count.scrutins,
                    nbAmendements: dossier._count.amendements,
                    loiNumero: dossier.loiNumero,
                  }}
                />
              ))}
            </ul>
            <Pagination
              page={page.page}
              total={page.totalPages}
              hrefFor={hrefFor}
              label="Pages de dossiers"
            />
          </>
        ) : (
          <EmptyState
            title="Aucun dossier trouvé"
            description={
              aDesFiltres(params)
                ? "Aucun dossier ne correspond à ces critères. Modifiez ou retirez des filtres."
                : "Aucun dossier législatif avec scrutin n'est disponible pour le moment."
            }
            action={
              aDesFiltres(params) ? (
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
