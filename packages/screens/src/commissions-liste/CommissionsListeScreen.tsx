"use client";

import { useApiQuery } from "@clair/api-client";
import {
  COMMISSION_TYPES,
  type CommissionListItem,
  type CommissionsPage,
  pageOf,
} from "@clair/data";
import {
  type ActiveFilter,
  Badge,
  Button,
  buildHref,
  Card,
  ChambreBadge,
  ChambreSwitch,
  Container,
  EmptyState,
  ErrorState,
  FilterBar,
  Link,
  LoadingState,
  PageHeader,
  SearchInput,
  useNavigation,
} from "@clair/ui";
import { Checkbox, NativeSelect } from "@mantine/core";
import type { ScreenProps } from "../shared/types.ts";
import classes from "./CommissionsListeScreen.module.css";
import { TYPES_COMMISSION, typeCommission } from "./libelles.ts";
import {
  aDesFiltres,
  type CommissionsListeParams,
  commissionsListeParamsOf,
  commissionsQueryOf,
  estVueParDefaut,
  parseCommissionsListeParams,
} from "./params.ts";

export type CommissionsListeScreenProps = ScreenProps<CommissionsPage>;

const CHAMBRE_LIBELLE = { assemblee: "Assemblée nationale", senat: "Sénat" } as const;

/** Ignore la casse et les accents : « defense » trouve « Défense ». */
const normaliser = (texte: string) => texte.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const filtrer = (commissions: CommissionListItem[], search: string) => {
  const cherche = normaliser(search);
  return cherche
    ? commissions.filter((c) => normaliser(`${c.nom} ${c.nomCourt ?? ""}`).includes(cherche))
    : commissions;
};

/** Sections par type d'organe, dans l'ordre institutionnel (permanentes d'abord). */
const parType = (commissions: CommissionListItem[]) => {
  const connus = COMMISSION_TYPES.map((type) => ({
    type: String(type),
    items: commissions.filter((c) => c.type === type),
  }));
  const autres = commissions.filter((c) => !COMMISSION_TYPES.some((type) => type === c.type));
  return [...connus, { type: "inconnu", items: autres }].filter((s) => s.items.length > 0);
};

const moisAnnee = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(iso),
  );

const CommissionCarte = ({ commission }: { commission: CommissionListItem }) => (
  <Card
    as="li"
    titleAs="h3"
    href={`/commissions/${encodeURIComponent(commission.slug)}`}
    title={commission.nom}
    eyebrow={
      <>
        <ChambreBadge chambre={commission.chambre} short size="sm" />
        {commission.actif ? null : <Badge size="sm">Inactive</Badge>}
      </>
    }
    footer={
      commission.dateDebut ? (
        <span className={classes.mention}>Depuis {moisAnnee(commission.dateDebut)}</span>
      ) : undefined
    }
  >
    <p className={classes.chiffres}>
      <span className="clair-chiffres">{commission.nbMembres.toLocaleString("fr-FR")}</span> membre
      {commission.nbMembres > 1 ? "s" : ""} ·{" "}
      <span className="clair-chiffres">{commission.nbReunions.toLocaleString("fr-FR")}</span>{" "}
      réunion{commission.nbReunions > 1 ? "s" : ""}
    </p>
  </Card>
);

/**
 * Liste des commissions et autres organes du Parlement, rangés par type : recherche (sur la
 * page), chambre, type et organes passés. Tout l'état vit dans l'URL (`search`, `chambre`,
 * `type`, `historique=1`).
 */
export const CommissionsListeScreen = ({
  params: rawParams,
  initialData,
}: CommissionsListeScreenProps) => {
  const { navigate, pathname } = useNavigation();
  const params = parseCommissionsListeParams(rawParams);
  const query = useApiQuery<CommissionsPage>("/commissions", commissionsQueryOf(params), {
    initialData: estVueParDefaut(params) ? initialData : undefined,
  });

  const update = (patch: Partial<CommissionsListeParams>) =>
    navigate(buildHref(pathname, commissionsListeParamsOf({ ...params, ...patch })));

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
          label: `Type : ${TYPES_COMMISSION[params.type].filtre}`,
          onRemove: () => update({ type: "" }),
        }
      : null,
    params.historique
      ? {
          id: "historique=1",
          label: "Organes passés inclus",
          onRemove: () => update({ historique: false }),
        }
      : null,
  ].filter((filtre): filtre is ActiveFilter => filtre !== null);

  const effacer = () => update({ search: "", chambre: "", type: "", historique: false });

  const commissions = query.data ? filtrer(pageOf(query.data).items, params.search) : [];
  const sections = parType(commissions);

  return (
    <Container className={classes.page}>
      <PageHeader
        breadcrumb={[{ label: "Accueil", href: "/" }, { label: "Commissions" }]}
        title="Commissions parlementaires"
        description={
          <>
            <p className={classes.lead}>
              Les commissions permanentes, d'enquête et spéciales, les délégations, missions et
              groupes de l'Assemblée nationale et du Sénat : leurs membres, leurs réunions et les
              textes dont elles sont saisies.
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
              · <Link href="/comprendre/commissions">Comprendre les commissions</Link>
            </p>
          </>
        }
      />

      <FilterBar
        label="Filtrer les commissions"
        search={
          <SearchInput
            aria-label="Rechercher une commission"
            placeholder="Rechercher une commission…"
            value={params.search}
            debounceMs={300}
            onChange={(search) => update({ search })}
          />
        }
        activeFilters={actifs}
        onReset={() => update({ chambre: "", type: "", historique: false })}
      >
        <ChambreSwitch
          value={params.chambre}
          onChange={(chambre) => update({ chambre })}
          withBoth
          compact
        />
        <NativeSelect
          label="Type d'organe"
          value={params.type}
          onChange={(event) => {
            const type = event.currentTarget.value;
            update({ type: COMMISSION_TYPES.find((valeur) => valeur === type) ?? "" });
          }}
          data={[
            { value: "", label: "Tous les types" },
            ...COMMISSION_TYPES.map((type) => ({
              value: type,
              label: TYPES_COMMISSION[type].filtre,
            })),
          ]}
        />
        <Checkbox
          className={classes.historique}
          label="Inclure les organes passés"
          checked={params.historique}
          onChange={(event) => update({ historique: event.currentTarget.checked })}
        />
      </FilterBar>

      <section aria-label="Résultats" className={classes.results}>
        {query.isPending ? (
          <LoadingState label="Chargement des commissions…" variant="skeleton" lines={6} />
        ) : query.isError ? (
          <ErrorState
            message="Les commissions n'ont pas pu être chargées. Vérifiez votre connexion puis réessayez."
            onRetry={() => query.refetch()}
          />
        ) : sections.length > 0 ? (
          <>
            <p className={classes.count} aria-live="polite">
              {commissions.length.toLocaleString("fr-FR")} organe
              {commissions.length > 1 ? "s" : ""}
              {params.historique ? " (actifs et passés)" : " actifs"}
              {aDesFiltres(params) ? " correspondant aux filtres" : ""}
            </p>
            {sections.map(({ type, items }) => (
              <section key={type} className={classes.section} aria-labelledby={`type-${type}`}>
                <h2 id={`type-${type}`} className={classes.sectionTitre}>
                  {typeCommission(type).section}{" "}
                  <span className={classes.sectionCompte}>({items.length})</span>
                </h2>
                <ul className={classes.grille}>
                  {items.map((commission) => (
                    <CommissionCarte key={commission.id} commission={commission} />
                  ))}
                </ul>
              </section>
            ))}
          </>
        ) : (
          <EmptyState
            title="Aucune commission trouvée"
            description={
              aDesFiltres(params)
                ? "Aucune commission ne correspond à ces critères. Modifiez ou retirez des filtres."
                : "Aucune commission n'est disponible pour le moment."
            }
            action={
              aDesFiltres(params) ? (
                <Button variant="secondaire" onClick={effacer}>
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
