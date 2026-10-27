"use client";

import { useApiQuery } from "@clair/api-client";
import type { ApiData, Chambre, ParlementaireCompare } from "@clair/data";
import {
  Button,
  buildHref,
  Container,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  ParlementaireCard,
  useNavigation,
} from "@clair/ui";
import { ArrowLeft, Plus } from "lucide-react";
import {
  CHAMBRE_CONFIG,
  circonscriptionLisible,
  MAX_COMPARAISON,
} from "../shared/parlementaires/chambre.ts";
import type { ScreenProps } from "../shared/types.ts";
import classes from "./ComparateurScreen.module.css";
import {
  type ComparateurFiltres,
  comparateurParamsOf,
  compareQueryOf,
  parseComparateurParams,
} from "./params.ts";
import { StatsComparees } from "./StatsComparees.tsx";
import { VotesCompares } from "./VotesCompares.tsx";

export type ComparateurScreenProps = ScreenProps<ApiData<ParlementaireCompare[]>> & {
  chambre: Chambre;
};

/** Nombre minimal d'élus pour comparer. */
const MIN = 2;

/**
 * Comparateur de deux à quatre députés ou sénateurs, choisis dans l'URL (`?slugs=a,b`) :
 * profils, statistiques côte à côte et votes comparés. Fusionne /deputes/comparer et
 * /senateurs/comparer de apps/web.
 */
export const ComparateurScreen = ({
  chambre,
  params = {},
  initialData,
}: ComparateurScreenProps) => {
  const { navigate, pathname } = useNavigation();
  const config = CHAMBRE_CONFIG[chambre];
  const filtres = parseComparateurParams(params);
  const assez = filtres.slugs.length >= MIN;
  const query = useApiQuery<ApiData<ParlementaireCompare[]>>(
    `${config.chemin}/compare`,
    compareQueryOf(filtres),
    { initialData, enabled: assez },
  );

  const aller = (suivants: ComparateurFiltres) =>
    navigate(buildHref(pathname, comparateurParamsOf(suivants)));
  const listeHref = (slugs: string[]) => buildHref(config.chemin, { compare: slugs.join(",") });
  const retirer = (slug: string) => {
    const restants = filtres.slugs.filter((candidat) => candidat !== slug);
    if (restants.length >= MIN) aller({ ...filtres, slugs: restants });
    else navigate(listeHref(restants));
  };

  // L'API renvoie les élus dans son ordre : on garde celui de l'URL.
  const elus = (query.data?.data ?? [])
    .slice()
    .sort((a, b) => filtres.slugs.indexOf(a.slug) - filtres.slugs.indexOf(b.slug));

  return (
    <Container className={classes.page}>
      <PageHeader
        title={`Comparaison de ${config.pluriel}`}
        breadcrumb={[
          { label: "Accueil", href: "/" },
          { label: config.titre, href: config.chemin },
          { label: "Comparer" },
        ]}
        description="Statistiques et votes de deux à quatre élus, côte à côte."
      />

      {!assez ? (
        <EmptyState
          title="Sélection insuffisante"
          description={`Choisissez au moins ${MIN} ${config.pluriel} dans la liste pour les comparer.`}
          action={
            <Button href={listeHref(filtres.slugs)} icon={<ArrowLeft />}>
              Choisir des {config.pluriel}
            </Button>
          }
        />
      ) : query.isPending ? (
        <LoadingState label="Chargement de la comparaison…" />
      ) : query.isError ? (
        <ErrorState
          message="La comparaison n'a pas pu être chargée. Vérifiez votre connexion puis réessayez."
          onRetry={() => query.refetch()}
        />
      ) : elus.length < MIN ? (
        <EmptyState
          title={`${config.titre} introuvables`}
          description="Certains élus de l'adresse n'existent pas ou plus."
          action={
            <Button href={config.chemin} icon={<ArrowLeft />}>
              Retour à la liste
            </Button>
          }
        />
      ) : (
        <>
          <section className={classes.section} aria-label={`${config.titre} comparés`}>
            <ul className={classes.profils}>
              {elus.map((elu) => (
                <ParlementaireCard
                  key={elu.slug}
                  as="li"
                  titleAs="h2"
                  chambre={chambre}
                  parlementaire={{
                    ...elu,
                    circonscription: circonscriptionLisible(elu.circonscription),
                  }}
                  href={`${config.chemin}/${elu.slug}`}
                  selectable
                  selected
                  onSelectedChange={(garde) => {
                    if (!garde) retirer(elu.slug);
                  }}
                />
              ))}
            </ul>
            {filtres.slugs.length < MAX_COMPARAISON ? (
              <div>
                <Button href={listeHref(filtres.slugs)} variant="secondaire" icon={<Plus />}>
                  Ajouter un {config.singulier}
                </Button>
              </div>
            ) : null}
          </section>
          <StatsComparees elus={elus} />
          <VotesCompares
            chemin={config.chemin}
            elus={elus}
            divergents={filtres.divergents}
            onDivergentsChange={(divergents) => aller({ ...filtres, divergents })}
          />
        </>
      )}
    </Container>
  );
};
