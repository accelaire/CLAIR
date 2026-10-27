"use client";

import { useApiQuery } from "@clair/api-client";
import type { ApiData, Chambre, PageVotes, ParlementaireDetail } from "@clair/data";
import {
  buildHref,
  Container,
  ErrorState,
  LoadingState,
  type TabItem,
  Tabs,
  useNavigation,
} from "@clair/ui";
import { CHAMBRE_CONFIG } from "../shared/parlementaires/chambre.ts";
import type { ScreenProps } from "../shared/types.ts";
import { FicheEnTete } from "./FicheEnTete.tsx";
import { FicheResumeIA } from "./FicheResumeIA.tsx";
import { FicheStatistiques } from "./FicheStatistiques.tsx";
import { nombreMandats, titreBilan } from "./meta.ts";
import { OngletAmendements } from "./OngletAmendements.tsx";
import type { OngletProps } from "./OngletCommun.tsx";
import { OngletDeclarations } from "./OngletDeclarations.tsx";
import { OngletInterventions } from "./OngletInterventions.tsx";
import { OngletMandats } from "./OngletMandats.tsx";
import { OngletVotes } from "./OngletVotes.tsx";
import classes from "./ParlementaireFicheScreen.module.css";
import {
  FICHE_QUERY,
  type OngletFiche,
  type ParlementaireFicheFiltres,
  parlementaireFicheParamsOf,
  parseParlementaireFicheParams,
} from "./params.ts";

/** Données chargées par la route : la fiche, et la première page de votes (onglet par défaut). */
export type ParlementaireFicheInitialData = {
  fiche?: ApiData<ParlementaireDetail>;
  votes?: PageVotes;
};

export type ParlementaireFicheScreenProps = ScreenProps<ParlementaireFicheInitialData> & {
  chambre: Chambre;
  slug: string;
};

const ONGLET_PAR_DEFAUT: Pick<ParlementaireFicheFiltres, "page" | "dissidents" | "votesPublics"> = {
  page: 1,
  dissidents: false,
  votesPublics: false,
};

/**
 * Fiche d'un député ou d'un sénateur : en-tête, statistiques (calculées), synthèse (IA), puis
 * onglets votes, amendements, interventions, mandats et déclarations HATVP (s'il y en a).
 * L'onglet actif, sa page et ses filtres vivent dans l'URL. Fusionne les fiches député et
 * sénateur de apps/web.
 */
export const ParlementaireFicheScreen = ({
  chambre,
  slug,
  params = {},
  initialData = {},
}: ParlementaireFicheScreenProps) => {
  const { navigate, pathname } = useNavigation();
  const { chemin } = CHAMBRE_CONFIG[chambre];
  const filtres = parseParlementaireFicheParams(params);
  const query = useApiQuery<ApiData<ParlementaireDetail>>(
    `${chemin}/${encodeURIComponent(slug)}`,
    FICHE_QUERY,
    {
      initialData: initialData.fiche,
    },
  );

  if (query.isPending) {
    return (
      <Container className={classes.page}>
        <LoadingState label="Chargement de la fiche…" />
      </Container>
    );
  }
  if (query.isError) {
    return (
      <Container className={classes.page}>
        <ErrorState
          message="La fiche n'a pas pu être chargée. Vérifiez votre connexion puis réessayez."
          onRetry={() => query.refetch()}
        />
      </Container>
    );
  }

  const fiche = query.data.data;
  const aller = (suivants: ParlementaireFicheFiltres) =>
    navigate(buildHref(pathname, parlementaireFicheParamsOf(suivants)));
  const ongletProps: OngletProps = {
    chemin,
    slug,
    filtres,
    changer: (changement) => aller({ ...filtres, ...changement, page: 1 }),
    pageHref: (page) => buildHref(pathname, parlementaireFicheParamsOf({ ...filtres, page })),
    dateMin: fiche.mandatsParlementaires
      .map((mandat) => mandat.dateDebut.slice(0, 10))
      .sort()
      .at(0),
  };

  const items: Array<TabItem & { value: OngletFiche }> = [
    { value: "votes", label: "Votes", content: null },
    { value: "amendements", label: "Amendements", content: null },
    { value: "interventions", label: "Interventions", content: null },
    {
      value: "mandats",
      label: "Mandats",
      count: fiche.mandatsParlementaires.length,
      content: null,
    },
    ...(fiche.declarations.length > 0
      ? [
          {
            value: "declarations" as const,
            label: "Déclarations HATVP",
            count: fiche.declarations.length,
            content: null,
          },
        ]
      : []),
  ];
  const onglet = items.some((item) => item.value === filtres.onglet) ? filtres.onglet : "votes";

  /** Seul l'onglet actif est rendu : les autres ne chargent rien. */
  const contenu = (valeur: OngletFiche) => {
    if (valeur !== onglet) return null;
    switch (valeur) {
      case "votes":
        return (
          <OngletVotes
            {...ongletProps}
            initialData={
              filtres.page === 1 && !filtres.dissidents && !filtres.dateFrom && !filtres.dateTo
                ? initialData.votes
                : undefined
            }
          />
        );
      case "amendements":
        return <OngletAmendements {...ongletProps} />;
      case "interventions":
        return <OngletInterventions {...ongletProps} />;
      case "mandats":
        return <OngletMandats fiche={fiche} />;
      case "declarations":
        return <OngletDeclarations declarations={fiche.declarations} />;
    }
  };

  return (
    <Container className={classes.page}>
      <FicheEnTete fiche={fiche} chambre={chambre} />
      {fiche.stats ? (
        <FicheStatistiques
          stats={fiche.stats}
          titre={fiche.actif ? "Statistiques" : titreBilan(nombreMandats(fiche, chambre) > 1)}
          calculeLe={fiche.statsCalculatedAt}
        />
      ) : null}
      <FicheResumeIA {...fiche} />
      <section className={classes.section} aria-label="Activité et mandats">
        <Tabs
          label={`Activité de ${fiche.prenom} ${fiche.nom}`}
          value={onglet}
          onChange={(valeur) => {
            const suivant = items.find((item) => item.value === valeur);
            if (suivant) aller({ ...filtres, ...ONGLET_PAR_DEFAUT, onglet: suivant.value });
          }}
          items={items.map((item) => ({ ...item, content: contenu(item.value) }))}
        />
      </section>
    </Container>
  );
};
