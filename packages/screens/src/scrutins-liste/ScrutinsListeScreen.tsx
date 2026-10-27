"use client";

import { useApiQuery } from "@clair/api-client";
import {
  type DossierTrending,
  type PageMeta,
  type PeriodeScrutins,
  pageOf,
  type ScrutinListItem,
  type ScrutinTag,
} from "@clair/data";
import {
  type ActiveFilter,
  Button,
  buildDateRangePresets,
  buildHref,
  ChambreSwitch,
  Container,
  DateRangePicker,
  type DateRangePreset,
  DossierCard,
  EmptyState,
  ErrorState,
  FilterBar,
  Link,
  LoadingState,
  PageHeader,
  Pagination,
  ScrutinCard,
  SearchInput,
  SectionHeader,
  useNavigation,
} from "@clair/ui";
import { NativeSelect } from "@mantine/core";
import {
  legislatureLabel,
  NATURES_VOTE,
  periodeScrutin,
  pluriel,
  scrutinHref,
  sessionLabel,
  TYPES_VOTE,
} from "../shared/scrutins.ts";
import type { ScreenProps } from "../shared/types.ts";
import {
  aDesFiltres,
  NATURES_FILTRABLES,
  parseScrutinsListeParams,
  type ScrutinsListeParams,
  scrutinsListeParamsOf,
  scrutinsQueryOf,
  TYPES_FILTRABLES,
} from "./params.ts";
import classes from "./ScrutinsListeScreen.module.css";

export type ScrutinsListeScreenProps = ScreenProps<PageMeta<ScrutinListItem>>;

const CHAMBRE_LIBELLE = { assemblee: "Assemblée nationale", senat: "Sénat" } as const;

const SANS_FILTRE: Partial<ScrutinsListeParams> = {
  chambre: "",
  type: "",
  nature: "",
  tag: "",
  dateFrom: "",
  dateTo: "",
};

const majuscule = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1);

const formatJour = (jour: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${jour}T12:00:00`),
  );

type PresetPeriode = DateRangePreset & { chambre: "assemblee" | "senat" };

/** Législatures (Assemblée) et sessions (Sénat) présentes en base, en raccourcis de période. */
const presetsPeriodes = (periodes: PeriodeScrutins[]): PresetPeriode[] =>
  periodes.map((periode) => ({
    chambre: periode.chambre,
    label:
      periode.chambre === "senat"
        ? `${sessionLabel(periode.session)} (Sénat)`
        : `${legislatureLabel(periode.legislature ?? Number(periode.session))} (Assemblée)`,
    from: periode.dateDebut,
    to: periode.dateFin,
  }));

/**
 * Liste des scrutins publics des deux chambres : dossiers en cours, recherche, filtres (chambre,
 * mode de scrutin, objet du vote, thématique, période) et pagination en liens. Tout l'état vit
 * dans l'URL, avec les mêmes clés que apps/web (`search`, `chambre`, `type`, `nature`, `tag`,
 * `dateFrom`, `dateTo`, `page`).
 */
export const ScrutinsListeScreen = ({
  params: rawParams,
  initialData,
}: ScrutinsListeScreenProps) => {
  const { navigate, pathname } = useNavigation();
  const params = parseScrutinsListeParams(rawParams);
  const query = useApiQuery<PageMeta<ScrutinListItem>>("/scrutins", scrutinsQueryOf(params), {
    initialData,
  });
  const tags = useApiQuery<{ data: ScrutinTag[] }>("/scrutins/tags");
  const periodes = useApiQuery<{ data: PeriodeScrutins[] }>("/scrutins/periodes", {
    chambre: params.chambre,
  });
  const trending = useApiQuery<{ data: DossierTrending[] }>("/dossiers/trending", { limit: 6 });

  /** Nouveau filtre : retour en page 1. */
  const update = (patch: Partial<ScrutinsListeParams>) =>
    navigate(buildHref(pathname, scrutinsListeParamsOf({ ...params, page: 1, ...patch })));
  const hrefFor = (page: number) => buildHref(pathname, scrutinsListeParamsOf({ ...params, page }));

  const periodesPresets = presetsPeriodes(periodes.data?.data ?? []);
  /** Une législature ou une session implique sa chambre : les deux s'écrivent en une fois. */
  const changePeriode = ({ from, to }: { from: string | null; to: string | null }) => {
    const periode = periodesPresets.find((preset) => preset.from === from && preset.to === to);
    update({
      dateFrom: from ?? "",
      dateTo: to ?? "",
      ...(periode ? { chambre: periode.chambre } : {}),
    });
  };

  const actifs: ActiveFilter[] = [
    params.chambre
      ? {
          id: `chambre=${params.chambre}`,
          label: `Chambre : ${CHAMBRE_LIBELLE[params.chambre]}`,
          onRemove: () => update({ chambre: "" }),
        }
      : null,
    params.type
      ? {
          id: `type=${params.type}`,
          label: `Mode : ${TYPES_VOTE[params.type] ?? params.type}`,
          onRemove: () => update({ type: "" }),
        }
      : null,
    params.nature
      ? {
          id: `nature=${params.nature}`,
          label: `Objet : ${NATURES_VOTE[params.nature] ?? params.nature}`,
          onRemove: () => update({ nature: "" }),
        }
      : null,
    params.tag
      ? {
          id: `tag=${params.tag}`,
          label: `Thématique : ${majuscule(params.tag)}`,
          onRemove: () => update({ tag: "" }),
        }
      : null,
    params.dateFrom || params.dateTo
      ? {
          id: "periode",
          label: `Période : ${params.dateFrom ? `du ${formatJour(params.dateFrom)}` : ""}${
            params.dateTo ? ` au ${formatJour(params.dateTo)}` : ""
          }`,
          onRemove: () => update({ dateFrom: "", dateTo: "" }),
        }
      : null,
  ].filter((filtre): filtre is ActiveFilter => filtre !== null);

  const page = query.data ? pageOf(query.data) : null;
  const dossiers = trending.data?.data ?? [];

  return (
    <Container className={classes.page}>
      <PageHeader
        breadcrumb={[{ label: "Accueil", href: "/" }, { label: "Scrutins" }]}
        title="Scrutins"
        description={
          <>
            <p className={classes.lead}>
              {page && !aDesFiltres(params) ? (
                <>
                  <span className="clair-chiffres">{page.total.toLocaleString("fr-FR")}</span> votes
                  publics de l'Assemblée nationale et du Sénat
                </>
              ) : (
                "Les votes publics de l'Assemblée nationale et du Sénat."
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
              · <Link href="/comprendre/scrutin">Qu'est-ce qu'un scrutin ?</Link> ·{" "}
              <Link href="/guide/decrypter-un-scrutin">Guide</Link> ·{" "}
              <Link href="/votes">Archives par année</Link>
            </p>
          </>
        }
      />

      {dossiers.length > 0 ? (
        <section className={classes.section} aria-labelledby="dossiers-en-cours">
          <SectionHeader
            id="dossiers-en-cours"
            title="Dossiers en cours"
            seeAllHref="/dossiers"
            seeAllLabel="Voir tous les dossiers"
          />
          <ul className={classes.dossiers}>
            {dossiers.map((dossier) => (
              <DossierCard
                key={dossier.id}
                as="li"
                titleAs="h3"
                href={`/dossiers/${encodeURIComponent(dossier.uid)}`}
                dossier={{
                  titre: dossier.titre,
                  procedureLibelle: dossier.procedureLibelle,
                  etat: dossier.etat,
                  lastScrutinDate: dossier.lastScrutinDate,
                  nbScrutins: dossier._count.scrutins,
                }}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <FilterBar
        label="Filtrer les scrutins"
        search={
          <SearchInput
            aria-label="Rechercher un scrutin"
            placeholder="Rechercher un scrutin…"
            value={params.search}
            debounceMs={300}
            onChange={(search) => update({ search })}
          />
        }
        activeFilters={actifs}
        onReset={() => update(SANS_FILTRE)}
      >
        <ChambreSwitch value={params.chambre} onChange={(chambre) => update({ chambre })} compact />
        <NativeSelect
          label="Mode de scrutin"
          value={params.type}
          onChange={(event) => {
            const valeur = event.currentTarget.value;
            update({ type: TYPES_FILTRABLES.find((type) => type === valeur) ?? "" });
          }}
          data={[
            { value: "", label: "Tous les modes" },
            ...TYPES_FILTRABLES.map((type) => ({ value: type, label: TYPES_VOTE[type] ?? type })),
          ]}
        />
        <NativeSelect
          label="Objet du vote"
          value={params.nature}
          onChange={(event) => {
            const valeur = event.currentTarget.value;
            update({ nature: NATURES_FILTRABLES.find((nature) => nature === valeur) ?? "" });
          }}
          data={[
            { value: "", label: "Tous les objets" },
            ...NATURES_FILTRABLES.map((nature) => ({
              value: nature,
              label: NATURES_VOTE[nature] ?? nature,
            })),
          ]}
        />
        <NativeSelect
          label="Thématique"
          value={params.tag}
          onChange={(event) => update({ tag: event.currentTarget.value })}
          data={[
            { value: "", label: "Toutes les thématiques" },
            ...(tags.data?.data ?? []).map((tag) => ({
              value: tag.name,
              label: `${majuscule(tag.name)} (${tag.count.toLocaleString("fr-FR")})`,
            })),
            ...(params.tag && !tags.data?.data.some((tag) => tag.name === params.tag)
              ? [{ value: params.tag, label: majuscule(params.tag) }]
              : []),
          ]}
        />
        <DateRangePicker
          label="Période"
          value={{ from: params.dateFrom || null, to: params.dateTo || null }}
          onChange={changePeriode}
          presets={[...periodesPresets, ...buildDateRangePresets()]}
        />
      </FilterBar>

      <section aria-label="Résultats" className={classes.results}>
        {query.isPending ? (
          <LoadingState label="Chargement des scrutins…" variant="skeleton" lines={6} />
        ) : query.isError ? (
          <ErrorState
            message="Les scrutins n'ont pas pu être chargés. Vérifiez votre connexion puis réessayez."
            onRetry={() => query.refetch()}
          />
        ) : page && page.items.length > 0 ? (
          <>
            <p className={classes.count} aria-live="polite">
              {pluriel(page.total, "scrutin")}
              {aDesFiltres(params) ? " correspondant aux filtres" : ""}
            </p>
            <ul className={classes.list}>
              {page.items.map((scrutin) => (
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
            <Pagination
              page={page.page}
              total={page.totalPages}
              hrefFor={hrefFor}
              label="Pages de scrutins"
            />
          </>
        ) : (
          <EmptyState
            title="Aucun scrutin trouvé"
            description={
              aDesFiltres(params)
                ? "Aucun scrutin ne correspond à ces critères. Modifiez ou retirez des filtres."
                : "Aucun scrutin n'est disponible pour le moment."
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
