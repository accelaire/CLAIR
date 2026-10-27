"use client";

import { ApiError, useApiQuery } from "@clair/api-client";
import type { DossierDetail, EtapeParcoursDossier } from "@clair/data";
import {
  Badge,
  Button,
  buildHref,
  ChambreBadge,
  Container,
  EmptyState,
  ErrorState,
  Link,
  LoadingState,
  PageHeader,
  parseStatut,
  StatutBadge,
  type TabItem,
  Tabs,
  useNavigation,
} from "@clair/ui";
import { ArrowRight, CalendarClock, FileText, Vote } from "lucide-react";
import type { ScreenProps } from "../shared/types.ts";
import { AmendementsDossier } from "./AmendementsDossier.tsx";
import { DossierContexte } from "./DossierContexte.tsx";
import classes from "./DossierFicheScreen.module.css";
import { ParcoursDossier } from "./ParcoursDossier.tsx";
import {
  type DossierFicheParams,
  dossierFicheParamsOf,
  type OngletDossier,
  parseDossierFicheParams,
} from "./params.ts";
import { ScrutinsDossier } from "./ScrutinsDossier.tsx";
import { titreCourtLisible, titreDossier } from "./titres.ts";

/** Données chargées par la route : le dossier et son parcours (qui décide de l'onglet par défaut). */
export type DossierFicheInitial = {
  dossier: DossierDetail;
  parcours?: EtapeParcoursDossier[] | null;
};

export type DossierFicheScreenProps = ScreenProps<DossierFicheInitial> & {
  /** Identifiant du dossier (`DLR5L17N…`). */
  uid: string;
};

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));

/**
 * Onglet affiché : celui de l'URL s'il a quelque chose à montrer, sinon le parcours quand il
 * existe (c'est par là qu'on entre dans un texte), puis les amendements, puis les scrutins.
 */
export const ongletEffectif = (
  demande: OngletDossier | null,
  { parcours, amendements }: { parcours: boolean; amendements: boolean },
): OngletDossier => {
  const parDefaut: OngletDossier = parcours ? "parcours" : amendements ? "amendements" : "scrutins";
  if (demande === "parcours" && !parcours) return parDefaut;
  if (demande === "amendements" && !amendements) return parDefaut;
  return demande ?? parDefaut;
};

const EnTete = ({ dossier }: { dossier: DossierDetail }) => {
  const statut = parseStatut(dossier.etat);
  const sources = [
    { label: "Assemblée nationale", href: dossier.urlAN },
    { label: "Sénat", href: dossier.urlSenat },
  ].filter((source): source is { label: string; href: string } => Boolean(source.href));
  return (
    <PageHeader
      breadcrumb={[
        { label: "Accueil", href: "/" },
        { label: "Dossiers législatifs", href: "/dossiers" },
        { label: titreCourtLisible(dossier) ?? "Dossier" },
      ]}
      title={titreDossier(dossier)}
      badges={
        <>
          <ChambreBadge chambre={dossier.chambre} />
          {statut ? (
            <StatutBadge statut={statut} />
          ) : dossier.etat ? (
            <Badge tone="neutre">{dossier.etat}</Badge>
          ) : null}
          {dossier.procedureLibelle ? (
            <Badge tone="neutre">{dossier.procedureLibelle}</Badge>
          ) : null}
        </>
      }
      description={
        <p className={classes.meta}>
          {dossier.dateDepot ? (
            <span>
              Déposé le <time dateTime={dossier.dateDepot}>{formatDate(dossier.dateDepot)}</time>
            </span>
          ) : null}
          {sources.length > 0 ? (
            <span>
              Sources officielles :{" "}
              {sources.map((source, index) => (
                <span key={source.label}>
                  {index > 0 ? ", " : null}
                  <Link href={source.href} external>
                    {source.label}
                  </Link>
                </span>
              ))}
            </span>
          ) : null}
        </p>
      }
      actions={
        dossier.sujet ? (
          <Button href={`/sujets/${dossier.sujet.slug}`} icon={<ArrowRight />} iconPosition="end">
            Voir l'analyse complète du sujet
          </Button>
        ) : undefined
      }
    />
  );
};

/**
 * Fiche d'un dossier législatif : en-tête (chambre, état, procédure, sources), commissions
 * saisies, résumé IA signalé, chiffres, loi promulguée, puis onglets dans l'URL (`?tab=`) :
 * parcours du texte (frise), amendements (filtrables) et scrutins (filtrables par objet du vote).
 */
export const DossierFicheScreen = ({
  uid,
  params: rawParams,
  initialData,
}: DossierFicheScreenProps) => {
  const { navigate, pathname } = useNavigation();
  const params = parseDossierFicheParams(rawParams);
  const chemin = `/dossiers/${encodeURIComponent(uid)}`;
  const query = useApiQuery<DossierDetail>(chemin, {}, { initialData: initialData?.dossier });
  const parcoursQuery = useApiQuery<{ data: EtapeParcoursDossier[] }>(
    `${chemin}/chronologie`,
    {},
    { initialData: initialData?.parcours ? { data: initialData.parcours } : undefined },
  );

  if (query.isPending) {
    return (
      <Container className={classes.page}>
        <LoadingState label="Chargement du dossier…" variant="skeleton" lines={6} />
      </Container>
    );
  }
  if (query.isError) {
    const introuvable = query.error instanceof ApiError && query.error.status === 404;
    return (
      <Container className={classes.page}>
        {introuvable ? (
          <EmptyState
            title="Dossier législatif introuvable"
            description={<Link href="/dossiers">Voir tous les dossiers législatifs</Link>}
          />
        ) : (
          <ErrorState onRetry={() => query.refetch()} />
        )}
      </Container>
    );
  }

  const dossier = query.data;
  const parcours = parcoursQuery.data?.data ?? [];
  const aUnParcours = parcours.length > 0 || parcoursQuery.isPending;
  const aDesAmendements = dossier.amendementsCount > 0;
  const onglet = ongletEffectif(params.amendement ? "amendements" : params.tab, {
    parcours: aUnParcours,
    amendements: aDesAmendements || params.amendement !== "",
  });

  const hrefOf = (patch: Partial<DossierFicheParams>) =>
    buildHref(pathname, dossierFicheParamsOf({ ...params, tab: onglet, ...patch }));
  /** Un changement de filtre revient en page 1. */
  const update = (patch: Partial<DossierFicheParams>) => navigate(hrefOf({ page: 1, ...patch }));
  const hrefFor = (page: number) => hrefOf({ page });

  const items: TabItem[] = [
    ...(aUnParcours
      ? [
          {
            value: "parcours",
            label: "Parcours",
            count: parcoursQuery.isPending ? undefined : parcours.length,
            icon: <CalendarClock />,
            content: parcoursQuery.isPending ? (
              <LoadingState label="Chargement du parcours…" />
            ) : (
              <ParcoursDossier etapes={parcours} />
            ),
          },
        ]
      : []),
    ...(aDesAmendements || params.amendement
      ? [
          {
            value: "amendements",
            label: "Amendements",
            count: dossier.amendementsCount,
            icon: <FileText />,
            content: (
              <AmendementsDossier
                dossier={dossier}
                params={params}
                onChange={update}
                hrefFor={hrefFor}
              />
            ),
          },
        ]
      : []),
    {
      value: "scrutins",
      label: "Scrutins",
      count: dossier.scrutinsCount,
      icon: <Vote />,
      content: (
        <ScrutinsDossier
          dossier={dossier}
          nature={params.nature}
          page={params.page}
          onNatureChange={(nature) => update({ nature })}
          hrefFor={hrefFor}
        />
      ),
    },
  ];

  return (
    <Container className={classes.page}>
      <EnTete dossier={dossier} />
      <DossierContexte dossier={dossier} />
      <section className={classes.section} aria-label="Détail du dossier">
        <Tabs
          label="Détail du dossier"
          items={items}
          value={onglet}
          onChange={(tab) =>
            navigate(
              buildHref(
                pathname,
                dossierFicheParamsOf({
                  ...params,
                  tab:
                    tab === "parcours" || tab === "amendements" || tab === "scrutins" ? tab : null,
                  amendement: "",
                  page: 1,
                }),
              ),
            )
          }
        />
      </section>
    </Container>
  );
};
