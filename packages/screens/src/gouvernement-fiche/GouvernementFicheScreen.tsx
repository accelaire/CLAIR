"use client";

import { ApiError, useApiQuery } from "@clair/api-client";
import type { GouvernementDetail, GouvernementDetailReponse } from "@clair/data";
import {
  Badge,
  buildHref,
  Container,
  EmptyState,
  ErrorState,
  Link,
  LoadingState,
  PageHeader,
  type TabItem,
  Tabs,
  useNavigation,
} from "@clair/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { NomMembre, PortraitMembre } from "../shared/gouvernements/ElementsGouvernement.tsx";
import {
  dateLongue,
  duree,
  etapes,
  jourAParis,
  nombre,
  nomPersonne,
  qualitePremierMinistre,
} from "../shared/gouvernements/gouvernements.ts";
import { useMaintenant } from "../shared/maintenant.ts";
import { useOngletAncre } from "../shared/onglet-ancre.ts";
import type { ScreenProps } from "../shared/types.ts";
import { BilanCensure, BilanTextes } from "./BilanGouvernement.tsx";
import { CompositionGouvernement } from "./CompositionGouvernement.tsx";
import classes from "./GouvernementFicheScreen.module.css";
import {
  type GouvernementFicheParams,
  gouvernementFicheParamsOf,
  ONGLETS_GOUVERNEMENT,
  type OngletGouvernement,
  ongletEffectif,
  parseGouvernementFicheParams,
} from "./params.ts";
import { TousLesPostes } from "./TousLesPostes.tsx";

export type GouvernementFicheScreenProps = ScreenProps<GouvernementDetailReponse> & {
  /** Slug du gouvernement (`lecornu-ii`). */
  slug: string;
  /** Instant du rendu serveur (ms), passé par la route : durée du gouvernement en fonction. */
  maintenant?: number;
};

/** Une ligne de la colonne de faits : libellé à gauche, valeur à droite. */
const Fait = ({ libelle, children }: { libelle: string; children: ReactNode }) => (
  <div className={classes.fait}>
    <dt>{libelle}</dt>
    <dd>{children}</dd>
  </div>
);

/** Les faits du gouvernement : Premier ministre, durée, membres, bilan, voisins. */
const ColonneFaits = ({
  g,
  jour,
  hrefOnglet,
}: {
  g: GouvernementDetail;
  jour: string;
  hrefOnglet: (onglet: OngletGouvernement) => string;
}) => {
  const pm = g.premierMinistre;
  const bilan = g.bilan ?? null;
  const femmes = typeof g.nbFemmes === "number" ? g.nbFemmes : null;
  const nbChangements = etapes(g, g.postes).length - 1;
  return (
    <aside className={classes.faits} aria-label={`Faits du gouvernement ${g.nom}`}>
      <div className={classes.carteFaits}>
        {pm ? (
          <div className={classes.pm}>
            <PortraitMembre personne={pm} size="lg" />
            <div>
              <p className={classes.mention}>{qualitePremierMinistre(pm)}</p>
              <p className={classes.fort}>
                <NomMembre personne={pm} />
              </p>
            </div>
          </div>
        ) : null}
        <dl className={classes.listeFaits}>
          <Fait libelle={g.enCours ? "En fonction depuis" : "Durée"}>
            {duree(g.dateDebut, g.dateFin ?? jour)}
          </Fait>
          <Fait libelle="Membres">{g.nbMembres}</Fait>
          {femmes !== null ? (
            <Fait libelle="Femmes">
              {femmes} ({Math.round((100 * femmes) / Math.max(g.nbMembres, 1))} %)
            </Fait>
          ) : null}
          <Fait libelle="Changements de composition">{nbChangements}</Fait>
        </dl>
        {bilan ? (
          <>
            <p className={classes.surtitre}>Bilan (calculé par CLAIR)</p>
            <dl className={classes.listeFaits}>
              <Fait libelle="Textes portés">
                <Link href={hrefOnglet("textes")}>{bilan.textes.portes}</Link>
              </Fait>
              <Fait libelle="dont promulgués">{bilan.textes.parStadePortes.promulgue}</Fait>
              {bilan.textes.total > bilan.textes.portes ? (
                <Fait libelle="Ratifications et conventions">
                  {bilan.textes.total - bilan.textes.portes}
                </Fait>
              ) : null}
              <Fait libelle="Recours au 49.3">
                <Link href={hrefOnglet("censure")}>{bilan.engagements.length}</Link>
              </Fait>
              <Fait libelle="Motions de censure">
                <Link href={hrefOnglet("censure")}>{bilan.motions.total}</Link>
                {bilan.motions.adoptees > 0 ? (
                  <span className={classes.adoptee}>
                    {" "}
                    ({nombre(bilan.motions.adoptees, "adoptée")})
                  </span>
                ) : null}
              </Fait>
            </dl>
          </>
        ) : null}
        {g.couverture === "avant_2017" ? (
          <p className={classes.mention}>Pas de données de bilan avant juin 2017.</p>
        ) : null}
      </div>
      <nav className={classes.voisins} aria-label="Gouvernements voisins">
        {g.precedent ? (
          <Link href={`/gouvernements/${g.precedent.slug}`}>
            <ChevronLeft size={16} aria-hidden="true" />
            <span className="clair-visually-hidden">Gouvernement précédent : </span>
            {g.precedent.nom}
          </Link>
        ) : (
          <span />
        )}
        {g.suivant ? (
          <Link href={`/gouvernements/${g.suivant.slug}`}>
            <span className="clair-visually-hidden">Gouvernement suivant : </span>
            {g.suivant.nom}
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        ) : null}
      </nav>
    </aside>
  );
};

/**
 * Page d'un gouvernement (reprise de `apps/web/app/gouvernements/[slug]/page.tsx`) : en-tête,
 * colonne de faits, puis onglets composition, textes portés, 49.3 et censure, tous les postes.
 * L'onglet ouvert (`onglet`) et l'étape de la composition (`etape`) vivent dans l'URL ; les
 * anciennes ancres (`#textes`, `#censure`) ouvrent l'onglet qu'elles nomment.
 */
export const GouvernementFicheScreen = ({
  slug,
  params: rawParams,
  initialData,
  maintenant: instant,
}: GouvernementFicheScreenProps) => {
  const { navigate, pathname } = useNavigation();
  const jour = jourAParis(useMaintenant(instant));
  const params = parseGouvernementFicheParams(rawParams);
  const hrefDe = (patch: Partial<GouvernementFicheParams>) =>
    buildHref(pathname, gouvernementFicheParamsOf({ ...params, ...patch }));
  const hrefOnglet = (onglet: OngletGouvernement) => hrefDe({ onglet, etape: "" });
  const barre = useOngletAncre(ONGLETS_GOUVERNEMENT, hrefOnglet);
  const query = useApiQuery<GouvernementDetailReponse>(
    `/gouvernements/${encodeURIComponent(slug)}`,
    {},
    { initialData },
  );

  if (query.isPending) {
    return (
      <Container className={classes.page}>
        <LoadingState label="Chargement du gouvernement…" variant="skeleton" lines={6} />
      </Container>
    );
  }
  if (query.isError) {
    return (
      <Container className={classes.page}>
        {query.error instanceof ApiError && query.error.status === 404 ? (
          <EmptyState
            title="Gouvernement introuvable"
            description="Ce gouvernement n'existe pas ou n'est plus référencé."
            action={<Link href="/gouvernements">Voir tous les gouvernements</Link>}
          />
        ) : (
          <ErrorState
            message="Le gouvernement n'a pas pu être chargé. Vérifiez votre connexion puis réessayez."
            onRetry={() => query.refetch()}
          />
        )}
      </Container>
    );
  }

  const { data: g, source, sourceBilan } = query.data;
  const domaines = query.data.domaines ?? [];
  const bilan = g.bilan ?? null;
  // Avant juin 2017, ni textes ni censure : la colonne de faits dit qu'il n'y a pas de données.
  const disponibles = ONGLETS_GOUVERNEMENT.filter(
    (o) => bilan !== null || (o !== "textes" && o !== "censure"),
  );
  const onglet = ongletEffectif(params.onglet, disponibles);

  const contenus: Record<OngletGouvernement, Omit<TabItem, "value"> | null> = {
    composition: {
      label: "Composition",
      count: g.nbMembres,
      content: (
        <CompositionGouvernement
          gouvernement={g}
          domaines={domaines}
          etape={params.etape}
          onEtape={(etape) => navigate(hrefDe({ onglet: "composition", etape }))}
        />
      ),
    },
    textes: bilan
      ? {
          label: "Textes portés",
          count: bilan.textes.portes,
          content: <BilanTextes bilan={bilan} domaines={domaines} />,
        }
      : null,
    censure: bilan
      ? {
          label: "49.3 et censure",
          // « 3 · 13 » comme apps/web, dit en toutes lettres aux lecteurs d'écran.
          count: `${bilan.engagements.length.toLocaleString("fr-FR")} · ${bilan.motions.total.toLocaleString("fr-FR")}`,
          countLabel: `${nombre(bilan.engagements.length, "recours au 49.3", "recours au 49.3")}, ${nombre(bilan.motions.total, "motion de censure", "motions de censure")}`,
          content: <BilanCensure bilan={bilan} />,
        }
      : null,
    postes: {
      label: "Tous les postes",
      count: g.nbPostes,
      content: <TousLesPostes postes={g.postes} />,
    },
  };
  const items = disponibles.flatMap((value) => {
    const contenu = contenus[value];
    return contenu ? [{ value, ...contenu }] : [];
  });

  return (
    <Container className={classes.page}>
      <PageHeader
        breadcrumb={[
          { label: "Accueil", href: "/" },
          { label: "Gouvernements", href: "/gouvernements" },
          { label: `Gouvernement ${g.nom}` },
        ]}
        title={`Gouvernement ${g.nom}`}
        badges={g.enCours ? <Badge tone="info">En fonction</Badge> : undefined}
        description={
          <p className={classes.chapo}>
            {g.dateFin
              ? `Du ${dateLongue(g.dateDebut)} au ${dateLongue(g.dateFin)}`
              : `Depuis le ${dateLongue(g.dateDebut)}`}
            {g.presidence ? ` · présidence de ${nomPersonne(g.presidence)}` : ""}
          </p>
        }
      />

      <div className={classes.grille}>
        <ColonneFaits g={g} jour={jour} hrefOnglet={hrefOnglet} />
        <section ref={barre} className={classes.onglets} aria-label={`Gouvernement ${g.nom}`}>
          <Tabs
            label={`Gouvernement ${g.nom}`}
            value={onglet}
            items={items}
            onChange={(valeur) =>
              navigate(hrefOnglet(disponibles.find((o) => o === valeur) ?? "composition"))
            }
          />
        </section>
      </div>

      <footer className={classes.sources}>
        <p className={classes.sourceTitre}>
          Source :{" "}
          <Link href={source.url} external>
            {source.nom}
          </Link>
          , gouvernement <span className={classes.code}>{g.uid}</span>.
        </p>
        <ul className={classes.sourceNotes}>
          <li>
            Chaque poste porte l’identifiant de son mandat (
            <span className={classes.code}>PM…</span>) dans cette source.
          </li>
          <li>
            Les dates sont celles qu’elle publie, en général celles de la publication au Journal
            officiel.
          </li>
          <li>
            Un membre sorti reste en fonction jusqu’à la nomination de son successeur, d’où des fins
            de poste au lendemain de la fin du gouvernement.
          </li>
          <li>
            Le classement des portefeuilles par domaine est celui de CLAIR : la source n’en donne
            pas.
          </li>
        </ul>
        {sourceBilan && bilan ? (
          <>
            <p className={classes.sourceTitre}>
              Bilan, calculé par CLAIR :{" "}
              <Link href={sourceBilan.url} external>
                {sourceBilan.nom}
              </Link>
              .
            </p>
            <ul className={classes.sourceNotes}>
              <li>Un projet est rattaché au poste de chacun de ses signataires.</li>
              <li>
                L’Assemblée ne nomme que le Premier ministre pour un projet déposé d’abord au Sénat
                : ses ministres viennent alors de la base DOSLEG du Sénat.
              </li>
              <li>
                Le stade est celui que le texte a atteint : promulgué, adopté définitivement,
                examiné en séance, ou déposé sans jamais l’être.
              </li>
              <li>Une motion de censure vise le gouvernement en fonction le jour du vote.</li>
            </ul>
          </>
        ) : null}
      </footer>
    </Container>
  );
};
