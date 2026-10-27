"use client";

import { useApiQuery } from "@clair/api-client";
import {
  type ApiData,
  type Chambre,
  type GroupeOption,
  type LegislatureDisponible,
  type PageMeta,
  type ParlementaireListItem,
  pageOf,
  type SessionDisponible,
} from "@clair/data";
import {
  Button,
  buildHref,
  ChambreSwitch,
  Container,
  EmptyState,
  ErrorState,
  Link,
  LoadingState,
  PageHeader,
  Pagination,
  ParlementaireCard,
  useNavigation,
} from "@clair/ui";
import {
  CHAMBRE_CONFIG,
  circonscriptionLisible,
  formatNombre,
  libelleLegislature,
  MAX_COMPARAISON,
} from "../shared/parlementaires/chambre.ts";
import type { ScreenProps } from "../shared/types.ts";
import { ListeFiltres, type PeriodeOption } from "./ListeFiltres.tsx";
import classes from "./ParlementairesListeScreen.module.css";
import {
  groupesQueryOf,
  listePaths,
  listeQueryOf,
  type ParlementairesListeFiltres,
  parlementairesListeParamsOf,
  parseParlementairesListeParams,
} from "./params.ts";
import { SelectionComparaison } from "./SelectionComparaison.tsx";

/** Données chargées par la route, côté serveur, pour les paramètres de l'URL. */
export type ParlementairesListeInitialData = {
  liste?: PageMeta<ParlementaireListItem>;
  groupes?: ApiData<GroupeOption[]>;
  periodes?: ApiData<Array<LegislatureDisponible | SessionDisponible>>;
};

export type ParlementairesListeScreenProps = ScreenProps<ParlementairesListeInitialData> & {
  chambre: Chambre;
};

const versPeriode = (periode: LegislatureDisponible | SessionDisponible): PeriodeOption =>
  "legislature" in periode
    ? { valeur: String(periode.legislature), label: libelleLegislature(periode.legislature) }
    : { valeur: periode.session, label: `Session ${periode.session}` };

/**
 * Liste des députés ou des sénateurs : recherche, filtres (groupe, période), tri, pagination en
 * liens et sélection pour le comparateur. Tout l'état vit dans l'URL ; la première page est
 * rendue côté serveur (`initialData`). Fusionne /deputes et /senateurs de apps/web.
 */
export const ParlementairesListeScreen = ({
  chambre,
  params = {},
  initialData = {},
}: ParlementairesListeScreenProps) => {
  const { navigate, pathname } = useNavigation();
  const config = CHAMBRE_CONFIG[chambre];
  const paths = listePaths(chambre);
  const filtres = parseParlementairesListeParams(params, chambre);

  const liste = useApiQuery<PageMeta<ParlementaireListItem>>(
    paths.liste,
    listeQueryOf(filtres, chambre),
    { initialData: initialData.liste },
  );
  const groupes = useApiQuery<ApiData<GroupeOption[]>>(
    paths.groupes,
    groupesQueryOf(filtres, chambre),
    { initialData: initialData.groupes },
  );
  const periodes = useApiQuery<ApiData<Array<LegislatureDisponible | SessionDisponible>>>(
    paths.periodes,
    {},
    { initialData: initialData.periodes },
  );

  const optionsPeriode = (periodes.data?.data ?? []).map(versPeriode);
  const periodeCourante = optionsPeriode[0];
  const periodeAffichee =
    optionsPeriode.find((periode) => periode.valeur === filtres.periode) ?? periodeCourante;
  const estPeriodeCourante = !filtres.periode || filtres.periode === periodeCourante?.valeur;

  const aller = (suivants: ParlementairesListeFiltres) =>
    navigate(buildHref(pathname, parlementairesListeParamsOf(suivants, chambre)));
  /** Un changement de filtre ramène à la première page ; la sélection du comparateur reste. */
  const changer = (changement: Partial<ParlementairesListeFiltres>) =>
    aller({ ...filtres, ...changement, page: 1 });
  const reinitialiser = () =>
    aller({
      recherche: "",
      groupe: "",
      periode: "",
      tri: "nom",
      page: 1,
      comparer: filtres.comparer,
    });
  const choisir = (slugs: string[]) => aller({ ...filtres, comparer: slugs });

  const page = liste.data ? pageOf(liste.data) : null;
  const pageHref = (numero: number) =>
    buildHref(pathname, parlementairesListeParamsOf({ ...filtres, page: numero }, chambre));

  const effectif = page
    ? estPeriodeCourante && !filtres.recherche && !filtres.groupe
      ? `${formatNombre(page.total)} ${config.pluriel} sur ${formatNombre(config.sieges)} sièges`
      : `${formatNombre(page.total)} ${config.pluriel}${estPeriodeCourante ? "" : " ont siégé"}`
    : null;

  return (
    <Container className={classes.page} data-selection={filtres.comparer.length > 0 || undefined}>
      <PageHeader
        title={config.titre}
        breadcrumb={[{ label: "Accueil", href: "/" }, { label: config.titre }]}
        description={
          <>
            <p className={classes.effectif}>
              {effectif ?? config.titre}
              {periodeAffichee ? ` — ${periodeAffichee.label}` : null}
            </p>
            <p className={classes.liens}>
              Source :{" "}
              <Link href={config.source.href} external>
                {config.source.label}
              </Link>
              <span aria-hidden="true"> · </span>
              <Link href="/comprendre/parlementaire">Comprendre les statistiques</Link>
              {chambre === "assemblee" ? (
                <>
                  <span aria-hidden="true"> · </span>
                  <Link href="/guide/decouvrir-mon-depute">Guide</Link>
                </>
              ) : null}
            </p>
          </>
        }
        actions={
          <ChambreSwitch
            value={chambre}
            withBoth={false}
            compact
            legend="Chambre affichée"
            hideLegend
            onChange={(valeur) => {
              if (valeur && valeur !== chambre) navigate(CHAMBRE_CONFIG[valeur].chemin);
            }}
          />
        }
      />

      <ListeFiltres
        chambre={chambre}
        filtres={filtres}
        groupes={groupes.data?.data ?? []}
        periodes={optionsPeriode}
        onChange={changer}
        onReset={reinitialiser}
      />

      <p className={classes.aide}>
        Cochez « Comparer » sur deux à {MAX_COMPARAISON} fiches pour comparer leurs votes et leurs
        statistiques.
      </p>

      <section aria-label={`Liste des ${config.pluriel}`} className={classes.resultats}>
        {liste.isPending ? (
          <LoadingState label={`Chargement des ${config.pluriel}…`} variant="skeleton" lines={6} />
        ) : liste.isError ? (
          <ErrorState
            message={`La liste des ${config.pluriel} n'a pas pu être chargée. Vérifiez votre connexion puis réessayez.`}
            onRetry={() => liste.refetch()}
          />
        ) : page && page.items.length === 0 ? (
          <EmptyState
            title={`Aucun ${config.singulier} trouvé`}
            description="Modifiez la recherche ou retirez des filtres."
            action={
              <Button variant="secondaire" onClick={reinitialiser}>
                Effacer les filtres
              </Button>
            }
          />
        ) : page ? (
          <>
            <p className={classes.compte} role="status">
              {formatNombre(page.total)} résultat{page.total > 1 ? "s" : ""}
              {page.totalPages > 1 ? ` — page ${page.page} sur ${page.totalPages}` : null}
            </p>
            <ul className={classes.grille}>
              {page.items.map((elu) => {
                const selectionne = filtres.comparer.includes(elu.slug);
                return (
                  <ParlementaireCard
                    key={elu.id}
                    as="li"
                    titleAs="h2"
                    chambre={chambre}
                    parlementaire={{
                      ...elu,
                      circonscription: circonscriptionLisible(elu.circonscription),
                    }}
                    href={`${config.chemin}/${elu.slug}`}
                    selectable
                    selected={selectionne}
                    selectionDisabled={!selectionne && filtres.comparer.length >= MAX_COMPARAISON}
                    onSelectedChange={(coche) =>
                      choisir(
                        coche
                          ? [...filtres.comparer, elu.slug]
                          : filtres.comparer.filter((slug) => slug !== elu.slug),
                      )
                    }
                  />
                );
              })}
            </ul>
            <Pagination
              page={page.page}
              total={page.totalPages}
              hrefFor={pageHref}
              label={`Pages de la liste des ${config.pluriel}`}
            />
          </>
        ) : null}
      </section>

      {filtres.comparer.length > 0 ? (
        <SelectionComparaison
          chambre={chambre}
          slugs={filtres.comparer}
          connus={page?.items ?? []}
          onChange={choisir}
        />
      ) : null}
    </Container>
  );
};
