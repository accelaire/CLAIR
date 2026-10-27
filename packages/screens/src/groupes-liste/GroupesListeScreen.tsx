"use client";

import { useApiQuery } from "@clair/api-client";
import type {
  ApiData,
  Chambre,
  GroupePolitique,
  LegislatureDisponible,
  PeriodeScrutins,
} from "@clair/data";
import {
  Button,
  buildHref,
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
import { libelleLegislature } from "../shared/parlementaires/chambre.ts";
import type { ScreenProps } from "../shared/types.ts";
import { cheminParlementaires, libelleSession } from "./format.ts";
import classes from "./GroupesListeScreen.module.css";
import {
  estVueParDefaut,
  type GroupesListeParams,
  groupesEndpointOf,
  groupesListeParamsOf,
  groupesQueryOf,
  parseGroupesListeParams,
} from "./params.ts";
import { type ChoixPeriode, SectionChambre } from "./SectionChambre.tsx";

export type GroupesListeScreenProps = ScreenProps<ApiData<GroupePolitique[]>>;

/** Ignore la casse et les accents : « ecologiste » trouve « Écologiste ». */
const normaliser = (texte: string) =>
  texte
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const correspond = (groupe: GroupePolitique, recherche: string) => {
  const cible = normaliser(recherche);
  return (
    normaliser(groupe.nom).includes(cible) || normaliser(groupe.nomComplet ?? "").includes(cible)
  );
};

/**
 * Liste des groupes politiques de l'Assemblée nationale et du Sénat : recherche, choix de la
 * chambre et de la période (législature, session), hémicycle et cartes par chambre. Tout l'état
 * vit dans l'URL, avec les clés de apps/web (`search`, `chambre`, `legislature`, `session`).
 */
export const GroupesListeScreen = ({ params: rawParams, initialData }: GroupesListeScreenProps) => {
  const { navigate, pathname } = useNavigation();
  const params = parseGroupesListeParams(rawParams);
  const update = (patch: Partial<GroupesListeParams>) =>
    navigate(buildHref(pathname, groupesListeParamsOf({ ...params, ...patch })));

  const query = useApiQuery<ApiData<GroupePolitique[]>>(
    groupesEndpointOf(params),
    groupesQueryOf(params),
    { initialData: estVueParDefaut(params) ? initialData : undefined },
  );
  const legislaturesQuery = useApiQuery<ApiData<LegislatureDisponible[]>>("/deputes/legislatures");
  const sessionsQuery = useApiQuery<ApiData<PeriodeScrutins[]>>(
    "/scrutins/periodes",
    { chambre: "senat" },
    { enabled: params.chambre !== "assemblee" },
  );

  const legislatures = legislaturesQuery.data?.data ?? [];
  const legislatureCourante = legislatures[0] ? String(legislatures[0].legislature) : "";
  const legislature = params.legislature || legislatureCourante;
  const sessions = [...(sessionsQuery.data?.data ?? [])].sort(
    (a, b) => Number(b.session) - Number(a.session),
  );
  const sessionCourante = sessions[0]?.session ?? "";
  const session = params.session || sessionCourante;

  const periodes: Record<Chambre, ChoixPeriode | null> = {
    assemblee:
      legislatures.length > 1
        ? {
            label: "Législature",
            value: legislature,
            options: legislatures.map((item) => ({
              value: String(item.legislature),
              label: libelleLegislature(item.legislature),
            })),
            onChange: (value) =>
              update({ legislature: value === legislatureCourante ? "" : value }),
          }
        : null,
    senat:
      sessions.length > 1
        ? {
            label: "Session sénatoriale",
            value: session,
            options: sessions.map((item) => ({
              value: item.session,
              label: libelleSession(item.session),
            })),
            onChange: (value) => update({ session: value === sessionCourante ? "" : value }),
          }
        : null,
  };
  const listeHref: Record<Chambre, string> = {
    assemblee:
      legislature && legislature !== legislatureCourante
        ? `/deputes?legislature=${legislature}`
        : cheminParlementaires("assemblee"),
    senat:
      session && session !== sessionCourante
        ? `/senateurs?session=${session}`
        : cheminParlementaires("senat"),
  };

  const groupes = query.data?.data ?? [];
  const visibles = params.search
    ? groupes.filter((groupe) => correspond(groupe, params.search))
    : groupes;
  const chambres: Chambre[] = params.chambre ? [params.chambre] : ["assemblee", "senat"];
  const sections = chambres
    .map((chambre) => ({
      chambre,
      tous: groupes.filter((groupe) => groupe.chambre === chambre),
      retenus: visibles.filter((groupe) => groupe.chambre === chambre),
    }))
    .filter(({ tous, retenus }) => tous.length > 0 && (!params.search || retenus.length > 0));

  const periodeQuery = (chambre: Chambre) =>
    chambre === "assemblee"
      ? params.legislature
        ? `?legislature=${params.legislature}`
        : ""
      : params.session
        ? `?session=${params.session}`
        : "";

  return (
    <Container className={classes.page}>
      <PageHeader
        breadcrumb={[{ label: "Accueil", href: "/" }, { label: "Groupes politiques" }]}
        title="Groupes parlementaires"
        description={
          <>
            <p className={classes.lead}>
              Les groupes politiques de l'Assemblée nationale et du Sénat, leurs effectifs et leur
              place dans l'hémicycle.
            </p>
            <p className={classes.sources}>
              <Link href="/comprendre/groupes-politiques">Comprendre les groupes politiques</Link>
            </p>
          </>
        }
      />

      <FilterBar
        label="Filtrer les groupes"
        search={
          <SearchInput
            aria-label="Rechercher un groupe"
            placeholder="Rechercher un groupe…"
            value={params.search}
            debounceMs={300}
            onChange={(search) => update({ search })}
          />
        }
        activeFilters={
          params.chambre
            ? [
                {
                  id: `chambre=${params.chambre}`,
                  label: `Chambre : ${params.chambre === "assemblee" ? "Assemblée nationale" : "Sénat"}`,
                  onRemove: () => update({ chambre: "" }),
                },
              ]
            : []
        }
        onReset={() => update({ chambre: "" })}
      >
        <ChambreSwitch value={params.chambre} onChange={(chambre) => update({ chambre })} />
      </FilterBar>

      <div className={classes.results}>
        {query.isPending ? (
          <LoadingState label="Chargement des groupes…" variant="skeleton" lines={6} />
        ) : query.isError ? (
          <ErrorState
            message="Les groupes n'ont pas pu être chargés. Vérifiez votre connexion puis réessayez."
            onRetry={() => query.refetch()}
          />
        ) : sections.length > 0 ? (
          sections.map(({ chambre, tous, retenus }) => (
            <SectionChambre
              key={chambre}
              chambre={chambre}
              groupes={tous}
              visibles={retenus}
              recherche={Boolean(params.search)}
              periode={periodes[chambre]}
              listeHref={listeHref[chambre]}
              periodeQuery={periodeQuery(chambre)}
            />
          ))
        ) : (
          <EmptyState
            title="Aucun groupe trouvé"
            description={
              params.search
                ? "Aucun groupe ne correspond à cette recherche."
                : "Aucun groupe politique n'est disponible pour cette période."
            }
            action={
              params.search ? (
                <Button variant="secondaire" onClick={() => update({ search: "" })}>
                  Voir tous les groupes
                </Button>
              ) : undefined
            }
          />
        )}
      </div>
    </Container>
  );
};
