"use client";

import { useApiQuery } from "@clair/api-client";
import type { ApiData, Chambre, GroupeAlliance, GroupeAlliances } from "@clair/data";
import {
  EmptyState,
  ErrorState,
  GroupeBadge,
  Link,
  LoadingState,
  ProvenanceLabel,
  SectionHeader,
} from "@clair/ui";
import { formatNombre, nomDuGroupe } from "../groupes-liste/format.ts";
import { METHODOLOGIE_INDICATEURS } from "./ChiffresGroupe.tsx";
import classes from "./GroupeFicheScreen.module.css";

type AlliancesGroupeProps = {
  chambre: Chambre;
  slug: string;
  legislature: string;
};

const ListeAlliances = ({
  titre,
  alliances,
  chambre,
  vide,
}: {
  titre: string;
  alliances: GroupeAlliance[];
  chambre: Chambre;
  vide: string;
}) => (
  <div className={classes.bloc}>
    <h3 className={classes.sousTitre}>{titre}</h3>
    {alliances.length > 0 ? (
      <ul className={classes.alliances}>
        {alliances.map(({ groupe, tauxAccord, votesCommuns, votesTotaux }) => (
          <li key={groupe.id} className={classes.alliance}>
            <GroupeBadge sigle={groupe.nom} couleur={groupe.couleur} size="sm" />
            <span className={classes.allianceNom}>
              <Link href={`/groupes/${chambre}/${groupe.slug}`}>{nomDuGroupe(groupe)}</Link>
              <span className={classes.mention}>
                {formatNombre(votesCommuns)} votes identiques sur {formatNombre(votesTotaux)}
              </span>
            </span>
            <span className={classes.valeur}>{tauxAccord}&nbsp;%</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className={classes.mention}>{vide}</p>
    )}
  </div>
);

/**
 * Proximité de vote avec les autres groupes, calculée par CLAIR : taux d'accord sur les
 * scrutins où les deux groupes ont voté. Présentation neutre, sans couleur de jugement.
 */
export const AlliancesGroupe = ({ chambre, slug, legislature }: AlliancesGroupeProps) => {
  const query = useApiQuery<ApiData<GroupeAlliances>>(
    `/groupes/${chambre}/${encodeURIComponent(slug)}/alliances`,
    {
      legislature,
    },
  );
  const alliances = query.data?.data;
  return (
    <section aria-labelledby="alliances" className={classes.section}>
      <SectionHeader
        id="alliances"
        title="Proximité de vote avec les autres groupes"
        description="Taux d'accord : part des scrutins où les deux groupes ont adopté la même position majoritaire."
      />
      {query.isPending ? (
        <LoadingState label="Chargement des proximités de vote…" />
      ) : query.isError ? (
        <ErrorState
          message="Les proximités de vote n'ont pas pu être chargées."
          onRetry={() => query.refetch()}
        />
      ) : alliances && (alliances.allies.length > 0 || alliances.opposes.length > 0) ? (
        <>
          <div className={classes.deuxColonnes}>
            <ListeAlliances
              titre="Votent le plus souvent comme le groupe (accord de 60 % ou plus)"
              alliances={alliances.allies}
              chambre={chambre}
              vide="Aucun groupe au-dessus de 60 % d'accord."
            />
            <ListeAlliances
              titre="Votent le plus souvent autrement (accord inférieur à 40 %)"
              alliances={alliances.opposes}
              chambre={chambre}
              vide="Aucun groupe en dessous de 40 % d'accord."
            />
          </div>
          <p className={classes.provenance}>
            <ProvenanceLabel provenance="calculee" methodologyHref={METHODOLOGIE_INDICATEURS} />
          </p>
        </>
      ) : (
        <EmptyState title="Aucune donnée de proximité disponible" />
      )}
    </section>
  );
};
