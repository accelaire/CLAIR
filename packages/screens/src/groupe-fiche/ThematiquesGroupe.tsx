"use client";

import { useApiQuery } from "@clair/api-client";
import type { ApiData, Chambre, GroupeThematiques } from "@clair/data";
import {
  BarChart,
  ChartFrame,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
} from "@clair/ui";
import { METHODOLOGIE_INDICATEURS } from "./ChiffresGroupe.tsx";
import classes from "./GroupeFicheScreen.module.css";

const LIBELLES: Record<string, string> = {
  budget: "Budget",
  fiscalité: "Fiscalité",
  social: "Social",
  travail: "Travail",
  santé: "Santé",
  éducation: "Éducation",
  sécurité: "Sécurité",
  justice: "Justice",
  environnement: "Environnement",
  europe: "Europe",
  international: "International",
  immigration: "Immigration",
  institutions: "Institutions",
  agriculture: "Agriculture",
  économie: "Économie",
  culture: "Culture",
};

/** Seuil de scrutins en dessous duquel une thématique n'est pas montrée (comme apps/web). */
const MIN_SCRUTINS = 3;

const libelle = (thematique: string) => LIBELLES[thematique] ?? thematique;

/**
 * Cohésion du groupe par thématique de scrutins (calculée par CLAIR) : barres horizontales
 * triées, avec le tableau des données. Remplace le radar Recharts de apps/web.
 */
export const ThematiquesGroupe = ({
  chambre,
  slug,
  legislature,
}: {
  chambre: Chambre;
  slug: string;
  legislature: string;
}) => {
  const query = useApiQuery<ApiData<GroupeThematiques>>(
    `/groupes/${chambre}/${encodeURIComponent(slug)}/thematiques`,
    {
      legislature,
    },
  );
  const thematiques = [...(query.data?.data.thematiques ?? [])]
    .filter((item) => item.votesTotaux >= MIN_SCRUTINS)
    .sort((a, b) => b.cohesion - a.cohesion);
  return (
    <section aria-labelledby="thematiques" className={classes.section}>
      <SectionHeader
        id="thematiques"
        title="Cohésion par thématique"
        description="Plus la cohésion est élevée, plus les membres du groupe votent de la même façon sur ce thème."
      />
      {query.isPending ? (
        <LoadingState label="Chargement des thématiques…" />
      ) : query.isError ? (
        <ErrorState
          message="Les thématiques n'ont pas pu être chargées."
          onRetry={() => query.refetch()}
        />
      ) : thematiques.length > 0 ? (
        <ChartFrame
          title="Cohésion du groupe par thème"
          subtitle={`Thèmes comptant au moins ${MIN_SCRUTINS} scrutins, en %`}
          headingLevel={3}
          provenance="calculee"
          methodologyHref={METHODOLOGIE_INDICATEURS}
          table={{
            caption: "Cohésion du groupe par thème de scrutins",
            columns: [
              { key: "theme", label: "Thème" },
              { key: "cohesion", label: "Cohésion (%)" },
              { key: "scrutins", label: "Scrutins" },
              { key: "pour", label: "Pour" },
              { key: "contre", label: "Contre" },
              { key: "abstention", label: "Abstention" },
            ],
            rows: thematiques.map((item) => ({
              theme: libelle(item.thematique),
              cohesion: item.cohesion,
              scrutins: item.votesTotaux,
              pour: item.votesPour,
              contre: item.votesContre,
              abstention: item.votesAbstention,
            })),
          }}
        >
          <BarChart
            data={thematiques.map((item) => ({
              theme: libelle(item.thematique),
              cohesion: item.cohesion,
            }))}
            categoryKey="theme"
            series={[{ key: "cohesion", label: "Cohésion" }]}
            horizontal
            unit="%"
            height={Math.max(160, thematiques.length * 32)}
          />
        </ChartFrame>
      ) : (
        <EmptyState title="Aucune donnée thématique disponible" />
      )}
    </section>
  );
};
