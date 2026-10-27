"use client";

import { ApiError, useApiQuery } from "@clair/api-client";
import type { ApiData, CommissionDetail } from "@clair/data";
import {
  Badge,
  buildHref,
  ChambreBadge,
  Container,
  EmptyState,
  ErrorState,
  Link,
  LoadingState,
  PageHeader,
  type TabItem,
  Tabs,
  useNavigation,
} from "@clair/ui";
import { typeCommission } from "../commissions-liste/libelles.ts";
import { useMaintenant } from "../shared/maintenant.ts";
import { pluriel } from "../shared/reunions/reunions.ts";
import { parlementaireHref } from "../shared/scrutins.ts";
import type { ScreenProps } from "../shared/types.ts";
import classes from "./CommissionFicheScreen.module.css";
import { DossiersCommission } from "./DossiersCommission.tsx";
import { HistoriqueReunions } from "./HistoriqueReunions.tsx";
import { MembresCommission, membresUniques } from "./MembresCommission.tsx";
import {
  type CommissionFicheParams,
  commissionFicheParamsOf,
  ongletEffectif,
  ongletsDisponibles,
  parseCommissionFicheParams,
} from "./params.ts";
import { ReunionCommission } from "./ReunionCommission.tsx";

export type CommissionFicheScreenProps = ScreenProps<ApiData<CommissionDetail>> & {
  /** Slug de la commission (`assemblee-commission-des-affaires-sociales`). */
  slug: string;
  /** Instant du rendu serveur (ms), passé par la route : réunions passées ou à venir. */
  maintenant?: number;
};

const dateLongue = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));

/** En-tête : nom, chambre, type, chiffres et présidence. */
const EnTete = ({ commission }: { commission: CommissionDetail }) => {
  const hemicycle = commission.type === "hemicycle";
  const presidence = commission.membres.find((m) =>
    m.qualite?.toLowerCase().startsWith("président"),
  );
  return (
    <PageHeader
      breadcrumb={[
        { label: "Accueil", href: "/" },
        { label: "Commissions", href: "/commissions" },
        { label: commission.nom },
      ]}
      title={commission.nom}
      badges={
        <>
          <ChambreBadge chambre={commission.chambre} />
          <Badge>{typeCommission(commission.type).singulier}</Badge>
          {commission.actif ? null : <Badge>Inactive</Badge>}
        </>
      }
      description={
        <>
          <p className={classes.chiffresEntete}>
            {[
              hemicycle ? null : pluriel(membresUniques(commission.membres).length, "membre"),
              `${pluriel(commission.nbReunions, hemicycle ? "séance" : "réunion")} au total`,
              !hemicycle && commission.nbDossiers > 0
                ? pluriel(commission.nbDossiers, "texte examiné", "textes examinés")
                : null,
              commission.dateDebut ? `depuis le ${dateLongue(commission.dateDebut)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {presidence ? (
            <p className={classes.presidence}>
              {presidence.qualite} :{" "}
              <Link
                href={parlementaireHref(
                  presidence.parlementaire.chambre,
                  presidence.parlementaire.slug,
                )}
              >
                {presidence.parlementaire.prenom} {presidence.parlementaire.nom}
              </Link>
            </p>
          ) : null}
          <p className={classes.sources}>
            Source :{" "}
            {commission.chambre === "senat" ? (
              <Link href="https://data.senat.fr" external>
                data.senat.fr
              </Link>
            ) : (
              <Link href="https://data.assemblee-nationale.fr" external>
                data.assemblee-nationale.fr
              </Link>
            )}{" "}
            · <Link href="/comprendre/commissions">Comprendre les commissions</Link>
          </p>
        </>
      }
    />
  );
};

/**
 * Fiche d'une commission (ou d'un autre organe) : membres, prochaines réunions, réunions
 * passées et textes saisis, en onglets dont l'état vit dans l'URL (`tab`, filtres des textes,
 * `page`). L'hémicycle n'a que ses séances.
 */
export const CommissionFicheScreen = ({
  slug,
  params: rawParams,
  initialData,
  maintenant: instant,
}: CommissionFicheScreenProps) => {
  const { navigate, pathname } = useNavigation();
  const maintenant = new Date(useMaintenant(instant));
  const params = parseCommissionFicheParams(rawParams);
  const query = useApiQuery<ApiData<CommissionDetail>>(
    `/commissions/${encodeURIComponent(slug)}`,
    {},
    { initialData },
  );

  if (query.isPending) {
    return (
      <Container className={classes.page}>
        <LoadingState label="Chargement de la commission…" variant="skeleton" lines={6} />
      </Container>
    );
  }
  if (query.isError) {
    return (
      <Container className={classes.page}>
        {query.error instanceof ApiError && query.error.status === 404 ? (
          <EmptyState
            title="Commission introuvable"
            description="Cette commission n'existe pas ou n'est plus référencée."
            action={<Link href="/commissions">Voir toutes les commissions</Link>}
          />
        ) : (
          <ErrorState
            message="La commission n'a pas pu être chargée. Vérifiez votre connexion puis réessayez."
            onRetry={() => query.refetch()}
          />
        )}
      </Container>
    );
  }

  const commission = query.data.data;
  const hemicycle = commission.type === "hemicycle";
  const disponibles = ongletsDisponibles(commission);
  const onglet = ongletEffectif(params.tab, disponibles);

  const aller = (patch: Partial<CommissionFicheParams>) =>
    navigate(buildHref(pathname, commissionFicheParamsOf({ ...params, page: 1, ...patch })));
  const hrefFor = (page: number) =>
    buildHref(pathname, commissionFicheParamsOf({ ...params, tab: onglet, page }));

  const prochaines = commission.prochainesReunions;
  const contenus: Record<(typeof disponibles)[number], Omit<TabItem, "value">> = {
    membres: {
      label: "Membres",
      count: membresUniques(commission.membres).length,
      content: (
        <MembresCommission membres={commission.membres} anciens={commission.anciensMembres ?? []} />
      ),
    },
    agenda: {
      label: hemicycle ? "Prochaines séances" : "Agenda",
      count: prochaines.length > 0 ? prochaines.length : undefined,
      content:
        prochaines.length > 0 ? (
          <div className={classes.pile}>
            <p className={classes.mention}>
              {pluriel(
                prochaines.length,
                hemicycle ? "prochaine séance" : "prochaine réunion",
                hemicycle ? "prochaines séances" : "prochaines réunions",
              )}
            </p>
            <ul className={classes.liste}>
              {prochaines.map((reunion) => (
                <ReunionCommission key={reunion.id} reunion={reunion} maintenant={maintenant} />
              ))}
            </ul>
          </div>
        ) : (
          <EmptyState
            title={
              hemicycle ? "Aucune séance à venir enregistrée" : "Aucune réunion à venir enregistrée"
            }
            action={<Link href="/agenda">Consulter l'agenda parlementaire</Link>}
          />
        ),
    },
    historique: {
      label: hemicycle ? "Séances passées" : "Historique",
      count: commission.nbReunions,
      content: (
        <HistoriqueReunions
          slug={slug}
          page={onglet === "historique" ? params.page : 1}
          hrefFor={hrefFor}
          maintenant={maintenant}
          seances={hemicycle}
        />
      ),
    },
    dossiers: {
      label: "Textes et rapports",
      count: commission.nbDossiers,
      content: (
        <DossiersCommission
          slug={slug}
          params={onglet === "dossiers" ? params : { ...params, page: 1 }}
          update={(patch) => aller({ tab: "dossiers", ...patch })}
          hrefFor={hrefFor}
        />
      ),
    },
  };

  return (
    <Container className={classes.page}>
      <EnTete commission={commission} />
      <section className={classes.onglets} aria-label="Activité de la commission">
        <Tabs
          label="Activité de la commission"
          value={onglet}
          items={disponibles.map((value) => ({
            value,
            ...contenus[value],
            // Seul l'onglet ouvert est rendu : les autres ne chargent rien.
            content: value === onglet ? contenus[value].content : null,
          }))}
          onChange={(tab) =>
            aller({
              tab: disponibles.find((valeur) => valeur === tab) ?? null,
              role: "",
              etat: "",
              dateFrom: "",
              dateTo: "",
            })
          }
        />
      </section>
    </Container>
  );
};
