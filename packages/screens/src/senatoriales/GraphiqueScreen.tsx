"use client";

import { useApiQuery } from "@clair/api-client";
import type { ApercuSenatoriales, ListeSortants, Sortant } from "@clair/data";
import { Container, ErrorState, LoadingState, useNavigation } from "@clair/ui";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import type { ScreenProps } from "../shared/types.ts";
import { CadreGraphique } from "./composants/CadreGraphique.tsx";
import { PastillesLecture } from "./composants/PastillesLecture.tsx";
import { BarresComptage } from "./graphiques/BarresComptage.tsx";
import { CarteDepartements } from "./graphiques/CarteDepartements.tsx";
import { DistributionBilan } from "./graphiques/DistributionBilan.tsx";
import { NuageActivite } from "./graphiques/NuageActivite.tsx";
import { PartRemiseEnJeu } from "./graphiques/PartRemiseEnJeu.tsx";
import { PyramideAges } from "./graphiques/PyramideAges.tsx";
import { COULEUR_SECONDAIRE } from "./lib/couleurs.ts";
import {
  GRAPHIQUES,
  parCommission,
  parFamilleProfession,
  SLUGS_GRAPHIQUES,
  type SlugGraphique,
  siegesParDepartement,
} from "./lib/graphiques.ts";
import classes from "./Senatoriales.module.css";

export type GraphiqueInitial = { apercu?: ApercuSenatoriales; sortants?: ListeSortants };

export type GraphiqueScreenProps = ScreenProps<GraphiqueInitial> & { slug: SlugGraphique };

const contenuGraphique = (
  slug: SlugGraphique,
  sortants: Sortant[],
  apercu: ApercuSenatoriales | undefined,
): ReactNode => {
  switch (slug) {
    case "carte":
      return <CarteDepartements sieges={siegesParDepartement(sortants)} />;
    case "groupes":
      return apercu ? <PartRemiseEnJeu parGroupe={apercu.sortants.parGroupe} /> : null;
    case "presence":
      return (
        <div className={classes.sections}>
          <section className={classes.pileSerree} aria-labelledby="graphique-presence">
            <h3 id="graphique-presence" className={classes.h3Petit}>
              Présence en séance
            </h3>
            <DistributionBilan sortants={sortants} metrique="presence" />
          </section>
          <section className={classes.pileSerree} aria-labelledby="graphique-loyaute">
            <h3 id="graphique-loyaute" className={classes.h3Petit}>
              Loyauté au groupe
            </h3>
            <DistributionBilan sortants={sortants} metrique="loyaute" />
          </section>
        </div>
      );
    case "activite":
      return <NuageActivite sortants={sortants} />;
    case "ages":
      return <PyramideAges sortants={sortants} />;
    case "commissions":
      return (
        <BarresComptage
          donnees={parCommission(sortants)}
          total={sortants.length}
          legende="Sortants par commission permanente"
        />
      );
    case "professions":
      return (
        <BarresComptage
          donnees={parFamilleProfession(sortants)}
          total={sortants.length}
          couleur={COULEUR_SECONDAIRE}
          legende="Sortants par famille professionnelle"
        />
      );
  }
};

/**
 * Page dédiée d'un graphique des sénatoriales (une URL par graphique, pour que l'aperçu
 * partagé soit le sien) : les mêmes composants que sur la page mère, en plein format, et les
 * six autres lectures en tête. Remplace `app/senatoriales-2026/graphiques/[slug]` de apps/web.
 */
export const GraphiqueScreen = ({ slug, initialData }: GraphiqueScreenProps) => {
  const { Link } = useNavigation();
  const meta = GRAPHIQUES[slug];
  const apercuQuery = useApiQuery<ApercuSenatoriales>(
    "/senatoriales/2026",
    {},
    { initialData: initialData?.apercu },
  );
  const sortantsQuery = useApiQuery<ListeSortants>(
    "/senatoriales/2026/sortants",
    {},
    { initialData: initialData?.sortants },
  );
  const sortants = sortantsQuery.data?.data ?? [];

  const corps = sortantsQuery.isPending ? (
    <LoadingState label="Chargement du graphique…" variant="skeleton" lines={6} />
  ) : sortantsQuery.isError ? (
    <ErrorState
      message="Les données ne sont pas disponibles pour le moment."
      onRetry={() => void sortantsQuery.refetch()}
    />
  ) : sortants.length === 0 ? (
    <p className={classes.mentionPetite}>Les données ne sont pas disponibles pour le moment.</p>
  ) : (
    contenuGraphique(slug, sortants, apercuQuery.data)
  );

  return (
    <Container className={classes.page} data-serre>
      <Link href="/senatoriales-2026" className={classes.retour}>
        <ArrowLeft aria-hidden="true" />
        Sénatoriales du 27 septembre 2026
      </Link>

      <PastillesLecture
        titre="Voir aussi"
        actif={slug}
        pastilles={SLUGS_GRAPHIQUES.map((autre) => ({
          cle: autre,
          label: GRAPHIQUES[autre].court,
          aide: GRAPHIQUES[autre].titre,
          href: `/senatoriales-2026/graphiques/${autre}`,
        }))}
      />

      <CadreGraphique slug={slug} titre={meta.titre} sousTitre={meta.sousTitre} niveauTitre="h1">
        {corps}
      </CadreGraphique>
    </Container>
  );
};
