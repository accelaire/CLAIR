"use client";

import { ApiError, useApiQuery } from "@clair/api-client";
import type { ScrutinDetail } from "@clair/data";
import {
  Badge,
  type BreadcrumbItem,
  Button,
  buildHref,
  ChambreBadge,
  Container,
  EmptyState,
  ErrorState,
  ExpandableText,
  LoadingState,
  PageHeader,
  ProvenanceLabel,
  parseStatut,
  StatutBadge,
  type TabItem,
  Tabs,
  useNavigation,
} from "@clair/ui";
import { FileText, MessageSquare, Vote } from "lucide-react";
import { titreCourtLisible } from "../dossier-fiche/titres.ts";
import { periodeScrutin } from "../shared/scrutins.ts";
import type { ScreenProps } from "../shared/types.ts";
import { AmendementsOnglet } from "./AmendementsOnglet.tsx";
import { DebatsOnglet } from "./DebatsOnglet.tsx";
import { DossierBandeau } from "./DossierBandeau.tsx";
import {
  ONGLETS,
  type Onglet,
  parseScrutinFicheParams,
  type ScrutinFicheParams,
  scrutinApiQuery,
  scrutinFicheParamsOf,
} from "./params.ts";
import classes from "./ScrutinFicheScreen.module.css";
import { ScrutinInfos } from "./ScrutinInfos.tsx";
import { VotesOnglet } from "./VotesOnglet.tsx";

export type ScrutinFicheScreenProps = ScreenProps<{ data: ScrutinDetail }> & {
  /** Numéro du scrutin (dans l'adresse) ; la chambre et la session viennent de `params`. */
  numero: number;
};

const majuscule = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1);

/**
 * Fiche d'un scrutin : dossier législatif, résumé IA signalé comme tel, informations (date,
 * demandeurs, mode, résultat officiel), puis onglets dans l'URL (`?onglet=`) : amendements mis aux
 * voix, débats qui ont précédé le vote, votes par groupe et par élu. Le scrutin est identifié par
 * son numéro, sa chambre et sa session (le numéro seul est ambigu).
 */
export const ScrutinFicheScreen = ({
  numero,
  params: rawParams,
  initialData,
}: ScrutinFicheScreenProps) => {
  const { navigate, pathname } = useNavigation();
  const params = parseScrutinFicheParams(rawParams);
  const query = useApiQuery<{ data: ScrutinDetail }>(
    `/scrutins/${encodeURIComponent(numero)}`,
    scrutinApiQuery(params),
    { initialData },
  );

  const href = (patch: Partial<ScrutinFicheParams>) =>
    buildHref(pathname, scrutinFicheParamsOf({ ...params, ...patch }));
  /** Un filtre change : la page des débats revient à 1. */
  const update = (patch: Partial<ScrutinFicheParams>) => navigate(href({ page: 1, ...patch }));

  if (query.isPending) {
    return (
      <Container className={classes.page}>
        <LoadingState label="Chargement du scrutin…" variant="skeleton" lines={8} />
      </Container>
    );
  }

  if (query.isError) {
    const introuvable = query.error instanceof ApiError && query.error.status === 404;
    return (
      <Container className={classes.page}>
        {introuvable ? (
          <EmptyState
            title="Scrutin introuvable"
            description="Ce numéro ne correspond à aucun scrutin de cette chambre et de cette période."
            action={
              <Button href="/scrutins" variant="secondaire">
                Voir tous les scrutins
              </Button>
            }
          />
        ) : (
          <ErrorState
            message="Le scrutin n'a pas pu être chargé. Vérifiez votre connexion puis réessayez."
            onRetry={() => query.refetch()}
          />
        )}
      </Container>
    );
  }

  const scrutin = query.data.data;
  const statut = parseStatut(scrutin.sort);
  const periode = periodeScrutin(scrutin);
  const amendementsCount = scrutin.amendements.length;
  const libelleDebats =
    scrutin.debatRattache === undefined
      ? "Débats"
      : scrutin.debatRattache
        ? "Débat du vote"
        : "Débats du jour";

  const items: (TabItem & { value: Onglet })[] = [
    ...(amendementsCount > 0
      ? [
          {
            value: "amendements" as const,
            label: "Amendements",
            count: amendementsCount,
            icon: <FileText />,
            content: <AmendementsOnglet scrutin={scrutin} />,
          },
        ]
      : []),
    ...(scrutin.totalInterventions > 0
      ? [
          {
            value: "debats" as const,
            label: libelleDebats,
            count: scrutin.totalInterventions,
            icon: <MessageSquare />,
            content: (
              <DebatsOnglet
                scrutin={scrutin}
                params={params}
                update={update}
                hrefFor={(page) => href({ onglet: "debats", page })}
              />
            ),
          },
        ]
      : []),
    {
      value: "vote",
      label: "Vote",
      count: scrutin.totalVotes,
      icon: <Vote />,
      content: <VotesOnglet scrutin={scrutin} params={params} update={update} />,
    },
  ];
  const ongletParDefaut: Onglet = amendementsCount > 0 ? "amendements" : "vote";
  const onglet = items.some((item) => item.value === params.onglet)
    ? params.onglet
    : ongletParDefaut;

  const breadcrumb: BreadcrumbItem[] = [
    { label: "Accueil", href: "/" },
    { label: "Scrutins", href: "/scrutins" },
    ...(scrutin.dossier
      ? [
          {
            label: titreCourtLisible(scrutin.dossier) ?? scrutin.dossier.titre,
            href: `/dossiers/${encodeURIComponent(scrutin.dossier.uid)}`,
          },
        ]
      : []),
    { label: `Scrutin n° ${scrutin.numero}` },
  ];

  return (
    <Container className={classes.page}>
      <PageHeader
        breadcrumb={breadcrumb}
        title={majuscule(scrutin.titre)}
        badges={
          <>
            <Badge tone="neutre">Scrutin n° {scrutin.numero}</Badge>
            <ChambreBadge chambre={scrutin.chambre} />
            {periode ? <Badge tone="neutre">{periode}</Badge> : null}
            {statut ? <StatutBadge statut={statut} /> : <Badge tone="neutre">{scrutin.sort}</Badge>}
          </>
        }
      />

      {scrutin.dossier ? <DossierBandeau dossier={scrutin.dossier} /> : null}

      {scrutin.resumeIA ? (
        <section className={classes.resume} aria-labelledby="en-clair">
          <div className={classes.resumeTete}>
            <h2 id="en-clair" className={classes.h2}>
              En clair
            </h2>
            <ProvenanceLabel provenance="ia" methodologyHref="/methodologie#enrichissement-ia" />
          </div>
          <ExpandableText maxLength={600}>{scrutin.resumeIA}</ExpandableText>
        </section>
      ) : null}

      <div className={classes.grille}>
        <aside className={classes.aside} aria-label="Informations sur le scrutin">
          <ScrutinInfos scrutin={scrutin} />
        </aside>
        <section className={classes.contenu} aria-labelledby="detail-scrutin">
          <h2 id="detail-scrutin" className="clair-visually-hidden">
            Détail du scrutin
          </h2>
          <Tabs
            label="Détail du scrutin"
            items={items}
            value={onglet}
            onChange={(value) => {
              const choisi = ONGLETS.find((item) => item === value) ?? "";
              navigate(href({ onglet: choisi === ongletParDefaut ? "" : choisi, page: 1 }));
            }}
          />
        </section>
      </div>
    </Container>
  );
};
