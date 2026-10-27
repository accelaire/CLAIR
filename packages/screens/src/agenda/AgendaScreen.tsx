"use client";

import { useApiQuery } from "@clair/api-client";
import type { AgendaResponse } from "@clair/data";
import {
  type ActiveFilter,
  buildHref,
  ChambreSwitch,
  Container,
  ErrorState,
  FilterBar,
  Link,
  LoadingState,
  PageHeader,
  useNavigation,
} from "@clair/ui";
import { NativeSelect } from "@mantine/core";
import { pluriel } from "../shared/reunions/reunions.ts";
import type { ScreenProps } from "../shared/types.ts";
import classes from "./AgendaScreen.module.css";
import { CalendrierDuMois } from "./CalendrierDuMois.tsx";
import { DetailDuJour } from "./DetailDuJour.tsx";
import { joursCouverts } from "./evenements.ts";
import {
  type AgendaParams,
  agendaParamsOf,
  agendaQueryOf,
  decalerMois,
  jourChoisi,
  jourParis,
  moisAffiche,
  parseAgendaParams,
  TYPES_AGENDA,
} from "./params.ts";

export type AgendaScreenProps = ScreenProps<AgendaResponse> & {
  /**
   * Aujourd'hui (`YYYY-MM-DD`, heure de Paris), fixé par la route : le serveur et le navigateur
   * affichent alors le même mois. Calculé à défaut.
   */
  aujourdhui?: string;
};

const TYPES = {
  commission: "Commissions",
  seance: "Séances publiques",
  evenement: "Événements institutionnels",
} as const;

const CHAMBRE_LIBELLE = { assemblee: "Assemblée nationale", senat: "Sénat" } as const;

const resumeDuMois = (data: AgendaResponse) => {
  const morceaux = [
    data.total > 0 ? `${pluriel(data.total, "réunion")} ce mois-ci` : null,
    data.evenements.length > 0 ? pluriel(data.evenements.length, "événement") : null,
  ].filter(Boolean);
  return morceaux.length > 0 ? morceaux.join(" · ") : "Rien d'enregistré ce mois-ci";
};

/**
 * Agenda parlementaire : calendrier du mois (réunions de commission, séances publiques et
 * repères institutionnels) et détail du jour choisi. Jour, mois, chambre et type vivent dans
 * l'URL (`date`, `mois`, `chambre`, `type`).
 */
export const AgendaScreen = ({ params: rawParams, initialData, aujourdhui }: AgendaScreenProps) => {
  const { navigate, pathname } = useNavigation();
  const params = parseAgendaParams(rawParams);
  const maintenant = new Date();
  const today = aujourdhui ?? jourParis(maintenant);
  const mois = moisAffiche(params, today);
  const jour = jourChoisi(params, today);
  const requete = agendaQueryOf(params, today);
  const query = useApiQuery<AgendaResponse>("/agenda", requete, {
    initialData: initialData?.dateFrom.startsWith(requete.dateFrom) ? initialData : undefined,
  });

  const update = (patch: Partial<AgendaParams>) =>
    navigate(buildHref(pathname, agendaParamsOf({ ...params, ...patch })));

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
          label: `Type : ${TYPES[params.type]}`,
          onRemove: () => update({ type: "" }),
        }
      : null,
  ].filter((filtre): filtre is ActiveFilter => filtre !== null);

  const data = query.data;
  const reunionsParJour = Object.fromEntries(
    Object.entries(data?.byDay ?? {}).map(([cle, reunions]) => [cle, reunions.length]),
  );

  return (
    <Container className={classes.page}>
      <PageHeader
        breadcrumb={[{ label: "Accueil", href: "/" }, { label: "Agenda" }]}
        title="Agenda parlementaire"
        description={
          <>
            <p className={classes.lead}>
              Réunions de commission, séances publiques et grandes échéances de l'Assemblée
              nationale et du Sénat.
              {data ? <> {resumeDuMois(data)}.</> : null}
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
              · <Link href="/comprendre/parlement">Comprendre le Parlement</Link>
            </p>
          </>
        }
      />

      <FilterBar
        label="Filtrer l'agenda"
        activeFilters={actifs}
        onReset={() => update({ chambre: "", type: "" })}
      >
        <ChambreSwitch
          value={params.chambre}
          onChange={(chambre) => update({ chambre })}
          withBoth
          compact
        />
        <NativeSelect
          label="Type"
          value={params.type}
          onChange={(event) => {
            const type = event.currentTarget.value;
            update({ type: TYPES_AGENDA.find((valeur) => valeur === type) ?? "" });
          }}
          data={[
            { value: "", label: "Tous les types" },
            ...TYPES_AGENDA.map((type) => ({ value: type, label: TYPES[type] })),
          ]}
        />
      </FilterBar>

      {query.isError ? (
        <div className={classes.erreur}>
          <ErrorState
            message="L'agenda n'a pas pu être chargé. Vérifiez votre connexion puis réessayez."
            onRetry={() => query.refetch()}
          />
        </div>
      ) : null}

      <div className={classes.disposition}>
        <section className={classes.panneau} aria-label="Calendrier">
          <CalendrierDuMois
            key={mois}
            mois={mois}
            reunionsParJour={reunionsParJour}
            evenements={data?.evenements ?? []}
            selection={jour}
            aujourdhui={today}
            onSelect={(date) => update({ date })}
            onMois={(ecart) => update({ date: "", mois: decalerMois(mois, ecart) })}
          />
        </section>
        <div className={classes.panneau}>
          {query.isPending ? (
            <LoadingState label="Chargement de l'agenda…" variant="skeleton" lines={5} />
          ) : data ? (
            <DetailDuJour
              jour={jour}
              reunions={jour ? (data.byDay[jour] ?? []) : []}
              evenements={
                jour ? data.evenements.filter((e) => joursCouverts(e).includes(jour)) : []
              }
              maintenant={maintenant}
            />
          ) : null}
        </div>
      </div>
    </Container>
  );
};
