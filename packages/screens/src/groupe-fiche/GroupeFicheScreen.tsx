"use client";

import { ApiError, useApiQuery } from "@clair/api-client";
import type { ApiData, Chambre, GroupeDetail } from "@clair/data";
import { buildHref, Container, ErrorState, Link, LoadingState, useNavigation } from "@clair/ui";
import { NotFoundScreen } from "../not-found/NotFoundScreen.tsx";
import type { ScreenProps } from "../shared/types.ts";
import { AlliancesGroupe } from "./AlliancesGroupe.tsx";
import { ChiffresGroupe } from "./ChiffresGroupe.tsx";
import { EnTeteGroupe } from "./EnTeteGroupe.tsx";
import classes from "./GroupeFicheScreen.module.css";
import { estTriMembres, MembresGroupe } from "./MembresGroupe.tsx";
import {
  type GroupeFicheParams,
  groupeFicheParamsOf,
  parseGroupeFicheParams,
  periodeQueryOf,
} from "./params.ts";
import { ThematiquesGroupe } from "./ThematiquesGroupe.tsx";
import { VotesGroupe } from "./VotesGroupe.tsx";

export type GroupeFicheScreenProps = ScreenProps<ApiData<GroupeDetail>> & {
  chambre: Chambre;
  slug: string;
};

/**
 * Fiche d'un groupe politique : en-tête (chambre, période, position déclarée), chiffres clés,
 * votes, proximité avec les autres groupes, cohésion par thème et membres. La période
 * (`legislature`, `session`), le filtre des scrutins et le tri des membres vivent dans l'URL.
 * Remplace `app/groupes/[chambre]/[slug]/PageClient.tsx` de apps/web.
 */
export const GroupeFicheScreen = ({
  chambre,
  slug,
  params,
  initialData,
}: GroupeFicheScreenProps) => {
  const { navigate, pathname } = useNavigation();
  const etat = parseGroupeFicheParams(params);
  const periode = periodeQueryOf(etat);
  const detail = useApiQuery<ApiData<GroupeDetail>>(
    `/groupes/${chambre}/${encodeURIComponent(slug)}`,
    periode,
    {
      initialData,
    },
  );
  const update = (patch: Partial<GroupeFicheParams>) =>
    navigate(buildHref(pathname, groupeFicheParamsOf({ ...etat, ...patch })));

  if (detail.isPending) {
    return (
      <Container className={classes.page}>
        <LoadingState label="Chargement du groupe…" />
      </Container>
    );
  }
  if (detail.isError) {
    if (detail.error instanceof ApiError && detail.error.status === 404) return <NotFoundScreen />;
    return (
      <Container className={classes.page}>
        <ErrorState onRetry={() => detail.refetch()} />
      </Container>
    );
  }
  const groupe = detail.data.data;
  // Sénat, session passée : alliances et thématiques ne sont calculées que pour la session
  // courante ; les afficher sous une composition d'époque serait trompeur (comme apps/web).
  const historique = groupe.session !== null && !groupe.sessionCourante;

  return (
    <Container className={classes.page}>
      <EnTeteGroupe groupe={groupe} />
      <ChiffresGroupe groupe={groupe} />
      <p className={classes.comparer}>
        <Link href={`/classements?tab=groupes&chambre=${groupe.chambre}&highlight=${groupe.slug}`}>
          Situer ce groupe dans le classement des groupes
        </Link>
      </p>
      <VotesGroupe
        chambre={chambre}
        slug={slug}
        periode={periode}
        initie={etat.initie}
        onInitieChange={(initie) => update({ initie })}
      />
      {historique ? (
        <p className={classes.mention}>
          Proximité de vote et cohésion par thème : données disponibles uniquement pour la session
          en cours.
        </p>
      ) : (
        <>
          <AlliancesGroupe chambre={chambre} slug={slug} legislature={etat.legislature} />
          <ThematiquesGroupe chambre={chambre} slug={slug} legislature={etat.legislature} />
        </>
      )}
      <MembresGroupe
        chambre={chambre}
        membres={groupe.membres}
        sort={{ key: etat.tri, direction: etat.ordre }}
        onSortChange={({ key, direction }) => {
          if (estTriMembres(key)) update({ tri: key, ordre: direction });
        }}
      />
    </Container>
  );
};
