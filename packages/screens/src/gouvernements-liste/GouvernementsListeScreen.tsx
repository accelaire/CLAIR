"use client";

import { useApiQuery } from "@clair/api-client";
import type { GouvernementResume, GouvernementsReponse } from "@clair/data";
import {
  Badge,
  Container,
  EmptyState,
  ErrorState,
  Link,
  LoadingState,
  PageHeader,
} from "@clair/ui";
import { Gavel, Users } from "lucide-react";
import { NomMembre, PortraitMembre } from "../shared/gouvernements/ElementsGouvernement.tsx";
import {
  dateLongue,
  de,
  duree,
  jourAParis,
  joursEntre,
  nombre,
  nomPersonne,
  qualitePremierMinistre,
} from "../shared/gouvernements/gouvernements.ts";
import { useMaintenant } from "../shared/maintenant.ts";
import type { ScreenProps } from "../shared/types.ts";
import classes from "./GouvernementsListeScreen.module.css";

export type GouvernementsListeScreenProps = ScreenProps<GouvernementsReponse> & {
  /** Instant du rendu serveur (ms), passé par la route : durée du gouvernement en fonction. */
  maintenant?: number;
};

type GroupePresidence = { cle: string; titre: string; gouvernements: GouvernementResume[] };

/** Les gouvernements regroupés par la présidence pendant laquelle ils ont commencé, dans l'ordre reçu. */
export const parPresidence = (gouvernements: readonly GouvernementResume[]): GroupePresidence[] => {
  const groupes: GroupePresidence[] = [];
  for (const g of gouvernements) {
    const cle = g.presidence?.uid ?? "sans";
    const existant = groupes.find((x) => x.cle === cle);
    if (existant) {
      existant.gouvernements.push(g);
    } else {
      groupes.push({
        cle,
        titre: g.presidence
          ? `Présidence ${de(nomPersonne(g.presidence))}`
          : "Présidence non renseignée",
        gouvernements: [g],
      });
    }
  }
  return groupes;
};

const partFemmes = (femmes: number, membres: number) =>
  Math.round((100 * femmes) / Math.max(membres, 1));

/**
 * Une carte de gouvernement. Toute la carte mène à sa page (le lien du titre la recouvre) ; le
 * lien vers la fiche du Premier ministre passe au-dessus et reste cliquable, sans lien imbriqué.
 */
const CarteGouvernement = ({
  g,
  plusLong,
  jour,
}: {
  g: GouvernementResume;
  plusLong: number;
  jour: string;
}) => {
  const pm = g.premierMinistre;
  const femmes = typeof g.nbFemmes === "number" ? g.nbFemmes : null;
  const jours = joursEntre(g.dateDebut, g.dateFin ?? jour);
  return (
    <li className={classes.carte} data-en-cours={g.enCours || undefined}>
      {pm ? <PortraitMembre personne={pm} size="md" /> : null}
      <div className={classes.corps}>
        <div className={classes.titreLigne}>
          <h3 className={classes.titre}>
            <Link href={`/gouvernements/${g.slug}`} className={classes.lienCarte}>
              Gouvernement {g.nom}
            </Link>
          </h3>
          {g.enCours ? <Badge tone="info">En fonction</Badge> : null}
        </div>
        {pm ? (
          <p className={classes.ligne}>
            {qualitePremierMinistre(pm)} :{" "}
            <span className={classes.auDessus}>
              <NomMembre personne={pm} />
            </span>
          </p>
        ) : null}
        <p className={classes.mention}>
          {dateLongue(g.dateDebut)} → {g.dateFin ? dateLongue(g.dateFin) : "en cours"}
        </p>
        <div className={classes.duree}>
          <div className={classes.barre} aria-hidden="true">
            <div
              className={classes.barreRemplie}
              style={{ inlineSize: `${(100 * jours) / plusLong}%` }}
            />
          </div>
          <span className={classes.dureeTexte}>
            <span className="clair-visually-hidden">Durée : </span>
            {duree(g.dateDebut, g.dateFin ?? jour)}
          </span>
        </div>
        <p className={classes.mention}>
          <Users size={14} aria-hidden="true" /> {g.nbMembres} membres
          {femmes !== null
            ? `, dont ${femmes} femmes (${partFemmes(femmes, g.nbMembres)} %)`
            : null}
        </p>
        {/* null avant juin 2017 : pas de données, et non zéro. */}
        {g.bilan ? (
          <p className={classes.mention}>
            <Gavel size={14} aria-hidden="true" />{" "}
            {nombre(g.bilan.engagements, "recours au 49.3", "recours au 49.3")},{" "}
            {nombre(g.bilan.motions, "motion de censure", "motions de censure")}
          </p>
        ) : null}
      </div>
    </li>
  );
};

/**
 * Liste des gouvernements depuis 2007 (reprise de `apps/web/app/gouvernements/page.tsx`) :
 * regroupés par présidence, du plus récent au plus ancien, avec une barre de durée comparée au
 * plus long gouvernement de la même présidence. La page n'a pas d'état d'URL.
 */
export const GouvernementsListeScreen = ({
  initialData,
  maintenant: instant,
}: GouvernementsListeScreenProps) => {
  const jour = jourAParis(useMaintenant(instant));
  const query = useApiQuery<GouvernementsReponse>("/gouvernements", {}, { initialData });

  const entete = (nb: number | null, source: GouvernementsReponse["source"] | null) => (
    <PageHeader
      breadcrumb={[{ label: "Accueil", href: "/" }, { label: "Gouvernements" }]}
      title="Gouvernements"
      description={
        <>
          {nb !== null ? (
            <p className={classes.chapo}>
              {nb} gouvernements depuis 2007, du plus récent au plus ancien.
            </p>
          ) : null}
          {source ? (
            <p className={classes.source}>
              Les gouvernements, leurs membres et leurs dates sont publiés par l’Assemblée nationale
              dans son open data, avec l’historique de ses députés : un même fichier pour les deux (
              <Link href={source.url} external>
                {source.nom}
              </Link>
              ). Les dates sont celles qu’il publie, en général celles du Journal officiel. Les
              recours au 49.3 et les motions de censure sont comptés par CLAIR (depuis juin 2017).
            </p>
          ) : null}
        </>
      }
    />
  );

  if (query.isPending) {
    return (
      <Container className={classes.page}>
        {entete(null, null)}
        <LoadingState label="Chargement des gouvernements…" variant="skeleton" lines={6} />
      </Container>
    );
  }
  if (query.isError) {
    return (
      <Container className={classes.page}>
        {entete(null, null)}
        <ErrorState
          message="La liste des gouvernements n'a pas pu être chargée. Vérifiez votre connexion puis réessayez."
          onRetry={() => query.refetch()}
        />
      </Container>
    );
  }

  const gouvernements = query.data.data;
  return (
    <Container className={classes.page}>
      {entete(gouvernements.length, query.data.source)}
      {gouvernements.length === 0 ? (
        <EmptyState title="Aucun gouvernement enregistré" />
      ) : (
        <div className={classes.sections}>
          {parPresidence(gouvernements).map((groupe) => {
            // Les durées se comparent au sein d'une présidence : à l'échelle du plus long
            // gouvernement depuis 2007, ceux d'un quinquennat agité paraîtraient minuscules.
            const durees = groupe.gouvernements.map((g) =>
              joursEntre(g.dateDebut, g.dateFin ?? jour),
            );
            const plusLong = Math.max(1, ...durees);
            const reference = groupe.gouvernements[durees.indexOf(plusLong)];
            return (
              <section key={groupe.cle} aria-labelledby={`presidence-${groupe.cle}`}>
                <h2 id={`presidence-${groupe.cle}`} className={classes.presidence}>
                  {groupe.titre}
                </h2>
                {reference && groupe.gouvernements.length > 1 ? (
                  <p className={classes.legende}>
                    <span className={classes.legendeBarre} aria-hidden="true" />
                    Durée de chaque gouvernement, comparée au plus long de cette présidence :{" "}
                    {reference.nom} ({duree(reference.dateDebut, reference.dateFin ?? jour)}).
                  </p>
                ) : null}
                <ul className={classes.grille}>
                  {groupe.gouvernements.map((g) => (
                    <CarteGouvernement key={g.uid} g={g} plusLong={plusLong} jour={jour} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </Container>
  );
};
