"use client";

import {
  buildHref,
  Container,
  Link,
  PageHeader,
  ShareButton,
  Tabs,
  useNavigation,
} from "@clair/ui";
import type { ScreenProps } from "../shared/types.ts";
import classes from "./ClassementsScreen.module.css";
import { OngletGroupes } from "./OngletGroupes.tsx";
import { OngletParlementaires } from "./OngletParlementaires.tsx";
import { type ClassementsParams, classementsParamsOf, parseClassementsParams } from "./params.ts";

export type ClassementsScreenProps = ScreenProps;

/**
 * Classements des parlementaires et des groupes politiques. Présentation apartisane : aucune
 * couleur de jugement, valeurs calculées par CLAIR signalées comme telles. Onglet, chambre,
 * critère, ordre, période, groupe, page et élément mis en avant vivent dans l'URL, avec les clés
 * de apps/web (`tab`, `chambre`, `sort`, `order`, `periode`, `groupe`, `page`, `highlight`,
 * `rank`, `groupeSort`). Remplace `app/classements/PageClient.tsx` de apps/web.
 */
export const ClassementsScreen = ({ params: rawParams }: ClassementsScreenProps) => {
  const { navigate, pathname } = useNavigation();
  const params = parseClassementsParams(rawParams);
  /** Tout changement de filtre revient à la première page. */
  const hrefFor = (patch: Partial<ClassementsParams>) =>
    buildHref(pathname, classementsParamsOf({ ...params, page: null, ...patch }));
  const update = (patch: Partial<ClassementsParams>) => navigate(hrefFor(patch));

  return (
    <Container className={classes.page}>
      <PageHeader
        breadcrumb={[{ label: "Accueil", href: "/" }, { label: "Classements" }]}
        title="Classements parlementaires"
        description={
          <>
            <p className={classes.lead}>
              Comparez l'activité des parlementaires et des groupes politiques.
            </p>
            <p className={classes.sources}>
              Indicateurs calculés par CLAIR à partir des données officielles, mis à jour chaque
              jour · <Link href="/comprendre/parlementaire">Comprendre les indicateurs</Link>
            </p>
          </>
        }
        actions={<ShareButton title="Classements parlementaires — CLAIR" />}
      />
      <Tabs
        label="Type de classement"
        value={params.tab}
        onChange={(tab) =>
          update({
            tab: tab === "groupes" ? "groupes" : "parlementaires",
            highlight: "",
            rank: null,
          })
        }
        items={[
          {
            value: "parlementaires",
            label: "Parlementaires",
            content:
              params.tab === "parlementaires" ? (
                <OngletParlementaires params={params} update={update} hrefFor={hrefFor} />
              ) : null,
          },
          {
            value: "groupes",
            label: "Groupes politiques",
            content:
              params.tab === "groupes" ? <OngletGroupes params={params} update={update} /> : null,
          },
        ]}
      />
    </Container>
  );
};
