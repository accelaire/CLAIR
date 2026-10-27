"use client";

import { ApiError, useApiQuery } from "@clair/api-client";
import type { PageMeta, SujetDetail, SujetDossier } from "@clair/data";
import {
  Badge,
  buildHref,
  Container,
  ErrorState,
  LoadingState,
  PageHeader,
  StatutBadge,
  useNavigation,
} from "@clair/ui";
import { NotFoundScreen } from "../not-found/NotFoundScreen.tsx";
import type { ScreenProps } from "../shared/types.ts";
import { formatDate, statutSujet } from "../sujets-liste/format.ts";
import { ContexteSujet } from "./ContexteSujet.tsx";
import { DocumentsLies, DossiersSujet } from "./DossiersSujet.tsx";
import { ParcoursSujet } from "./ParcoursSujet.tsx";
import {
  DOSSIERS_DU_SUJET,
  parseSujetFicheParams,
  type SujetFicheParams,
  sujetFicheParamsOf,
} from "./params.ts";
import { RessourcesSujet } from "./RessourcesSujet.tsx";
import { ScrutinsSujet } from "./ScrutinsSujet.tsx";
import { StatsGroupes } from "./StatsGroupes.tsx";
import classes from "./SujetFicheScreen.module.css";

/** Données chargées par la route : le sujet et ses dossiers. */
export type SujetFicheInitial = {
  sujet: { data: SujetDetail };
  dossiers?: PageMeta<SujetDossier>;
};

export type SujetFicheScreenProps = ScreenProps<SujetFicheInitial> & { slug: string };

/**
 * Fiche d'un sujet : en-tête (statut, dates), parcours parlementaire, contexte (résumé IA
 * signalé, loi promulguée), ressources, dossiers, groupes politiques et scrutins.
 * Remplace `app/sujets/[slug]/PageClient.tsx` de apps/web.
 */
export const SujetFicheScreen = ({ slug, params, initialData }: SujetFicheScreenProps) => {
  const { navigate, pathname } = useNavigation();
  const etat = parseSujetFicheParams(params);
  const detail = useApiQuery<{ data: SujetDetail }>(
    `/sujets/${encodeURIComponent(slug)}`,
    {},
    { initialData: initialData?.sujet },
  );
  const sujet = detail.data?.data;
  const dossiersQuery = useApiQuery<PageMeta<SujetDossier>>(
    `/sujets/${encodeURIComponent(slug)}/dossiers`,
    DOSSIERS_DU_SUJET,
    { initialData: initialData?.dossiers, enabled: sujet !== undefined },
  );
  const dossiers = dossiersQuery.data?.data ?? [];

  const hrefPour = (changement: Partial<SujetFicheParams>) =>
    buildHref(pathname, sujetFicheParamsOf({ ...etat, ...changement }));

  if (detail.isPending) {
    return (
      <Container className={classes.page}>
        <LoadingState label="Chargement du sujet…" />
      </Container>
    );
  }
  if (detail.isError) {
    if (detail.error instanceof ApiError && detail.error.status === 404) return <NotFoundScreen />;
    return (
      <Container className={classes.page}>
        <ErrorState onRetry={() => void detail.refetch()} />
      </Container>
    );
  }
  if (!sujet) return <NotFoundScreen />;

  const statut = statutSujet(sujet.status);
  const dates = [
    sujet.dateDebut ? `Déposé le ${formatDate(sujet.dateDebut)}` : null,
    sujet.dateDernierVote ? `Dernier vote le ${formatDate(sujet.dateDernierVote)}` : null,
    statut === "promulgue" && sujet.dateFin ? `Promulgué le ${formatDate(sujet.dateFin)}` : null,
  ].filter(Boolean);

  return (
    <Container className={classes.page}>
      <PageHeader
        title={sujet.label}
        breadcrumb={[
          { label: "Accueil", href: "/" },
          { label: "Sujets", href: "/sujets" },
          { label: sujet.label },
        ]}
        badges={
          <>
            <StatutBadge statut={statut} />
            {sujet.category ? <Badge tone="neutre">{sujet.category}</Badge> : null}
          </>
        }
        description={
          <>
            {sujet.description ? <p className={classes.lead}>{sujet.description}</p> : null}
            {dates.length > 0 ? <p className={classes.dates}>{dates.join(" · ")}</p> : null}
          </>
        }
      />

      <div className={classes.content}>
        <ParcoursSujet slug={slug} sujet={sujet} dossiers={dossiers} />
        <ContexteSujet sujet={sujet} dossiers={dossiers} />
        <RessourcesSujet slug={slug} liens={sujet.liens} />

        <div className={classes.dashboard}>
          <div className={classes.stack}>
            <DossiersSujet dossiers={dossiers} />
            <DocumentsLies slug={slug} />
            <ScrutinsSujet
              slug={slug}
              totalSujet={sujet.scrutinCount}
              chambre={etat.chambre}
              nature={etat.nature}
              page={etat.page}
              hrefFor={(filtres) => hrefPour(filtres)}
              navigate={navigate}
            />
          </div>
          <StatsGroupes
            slug={slug}
            dossiers={dossiers}
            chambre={etat.groupes}
            tri={etat.tri}
            onChange={(choix) => navigate(hrefPour(choix))}
          />
        </div>
      </div>
    </Container>
  );
};
