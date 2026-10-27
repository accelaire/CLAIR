"use client";

import { useApiQuery } from "@clair/api-client";
import type { ListeCandidats, ListeSortants, ResultatsCirconscription } from "@clair/data";
import { Container, ErrorState, Link, LoadingState, useNavigation } from "@clair/ui";
import { ArrowLeft, Info } from "lucide-react";
import type { ScreenProps } from "../shared/types.ts";
import { EncartSoutien } from "./composants/EncartSoutien.tsx";
import { EnDirect } from "./composants/EnDirect.tsx";
import { ListeCandidatureCard } from "./composants/ListeCandidatureCard.tsx";
import { SortantCard } from "./composants/SortantCard.tsx";
import { JOUR_DU_SCRUTIN } from "./lib/calendrier.ts";
import { modeDeScrutin } from "./lib/circonscription.ts";
import { locutionDepuisCode } from "./lib/departements.ts";
import { accorde, heureDeParis, pluriel } from "./lib/format.ts";
import { directCirconscription } from "./lib/resultats.ts";
import { sortantsCirconscriptionQuery } from "./params.ts";
import {
  AttenteResultats,
  BlocParticipation,
  CarteElus,
  ListeEnTete,
  ListesEtCandidats,
  RepartitionSieges,
  ResultatsParListe,
  TourMajoritaire,
} from "./resultats/BlocsCirconscription.tsx";
import { BadgeCirconscription } from "./resultats/Etats.tsx";
import classes from "./Senatoriales.module.css";

/** Listes de la circonscription chargées par la route (`undefined` : chargées par l'écran). */
export type CirconscriptionInitial = { sortants?: ListeSortants; candidats?: ListeCandidats };

export type CirconscriptionScreenProps = ScreenProps<CirconscriptionInitial> & {
  /** Circonscription résolue par la route (code INSEE, nom sans rappel de série, sièges). */
  circonscription: { code: string; nom: string; nbSieges: number };
  /** Nombre de circonscriptions renouvelées, pour le lien vers la page mère. */
  nbCirconscriptions: number;
  /** Résultats du ministère (cache d'une minute), `null` si l'API ne répond pas. */
  resultats?: ResultatsCirconscription | null;
  /** Instant du rendu serveur (ISO) : la page dit la même chose au serveur et au navigateur. */
  maintenant: string;
};

/**
 * Page d'une circonscription des sénatoriales : avant le scrutin, les candidats et le bilan des
 * sortants ; le jour même, l'attente des résultats ; ensuite les élus, les voix, la répartition
 * des sièges, la participation et le sort de chaque sortant. Remplace
 * `app/senatoriales-2026/[departement]/page.tsx` de apps/web.
 */
export const CirconscriptionScreen = ({
  circonscription,
  nbCirconscriptions,
  initialData,
  resultats = null,
  maintenant: maintenantIso,
}: CirconscriptionScreenProps) => {
  const { Link: RouterLink } = useNavigation();
  const { code, nom, nbSieges } = circonscription;
  const sortantsQuery = useApiQuery<ListeSortants>(
    "/senatoriales/2026/sortants",
    sortantsCirconscriptionQuery(code),
    { initialData: initialData?.sortants },
  );
  const candidatsQuery = useApiQuery<ListeCandidats>(
    "/senatoriales/2026/candidats",
    { departement: code },
    { initialData: initialData?.candidats },
  );

  const scrutinLocal = modeDeScrutin(nbSieges);
  const ou = locutionDepuisCode(code, nom);
  const liste = sortantsQuery.data?.data ?? [];
  const listesCandidats = candidatsQuery.data?.data ?? [];
  const candidaturesPubliees = listesCandidats.length > 0;
  const nbCandidats = candidatsQuery.data?.meta.candidats ?? 0;

  const circoResultats = resultats?.circonscription ?? null;
  const proportionnel = circoResultats?.modeScrutin === "proportionnel";
  const publie = Boolean(resultats && resultats.tours.length > 0);
  const premierTour = resultats?.tours.find((t) => t.tour === 1);
  const secondTour = resultats?.tours.find((t) => t.tour === 2);
  const dernierTour = secondTour ?? premierTour;
  const maintenant = new Date(resultats?.maintenant ?? maintenantIso);
  // Le jour même, ou dès l'ouverture des bureaux (Wallis-et-Futuna vote dès le samedi soir).
  const jourJ =
    maintenant >= JOUR_DU_SCRUTIN ||
    (circoResultats !== null && circoResultats.statut !== "pas_ouvert");
  const direct = directCirconscription(resultats);
  const sortantsCandidats = liste.filter((s) => s.candidature).length;
  const sortDuSortant = new Map((resultats?.sortants ?? []).map((s) => [s.mandatId, s.sort]));
  const desSortants = liste.length > 1 ? "des sortants" : "du sortant";

  const chapeau = publie
    ? `${nbSieges} ${pluriel(nbSieges, "siège")} de sénateur ${accorde(nbSieges, "était remis", "étaient remis")} en jeu le dimanche 27 septembre 2026. Voici les résultats, et le bilan de mandature ${desSortants}.`
    : jourJ
      ? `${nbSieges} ${pluriel(nbSieges, "siège")} de sénateur ${accorde(nbSieges, "est remis", "sont remis")} en jeu ${maintenant >= JOUR_DU_SCRUTIN ? "aujourd'hui, " : ""}dimanche 27 septembre 2026. Voici ${scrutinLocal.unite === "liste" ? "les listes en lice" : "les candidats"} et le bilan de mandature ${desSortants}.`
      : `${nbSieges} ${pluriel(nbSieges, "siège")} de sénateur ${accorde(nbSieges, "est remis", "sont remis")} en jeu le dimanche 27 septembre 2026. Voici le bilan de mandature ${desSortants}.`;

  return (
    <Container className={classes.page} data-serre>
      <RouterLink href="/senatoriales-2026" className={classes.retour}>
        <ArrowLeft aria-hidden="true" />
        Sénatoriales du 27 septembre 2026
      </RouterLink>

      <div className={classes.enteteSerre}>
        <h1 className={classes.h1} data-taille="fiche">
          Sénatoriales 2026 {ou}
        </h1>
        <p className={classes.chapeau}>{chapeau}</p>
        {resultats && circoResultats && (jourJ || publie) ? (
          <div className={classes.meta}>
            {direct ? <EnDirect /> : null}
            <BadgeCirconscription statut={circoResultats.statut} />
            <span>
              {dernierTour ? "Publiés à " : "Mis à jour à "}
              <strong className={classes.fort}>
                {heureDeParis(dernierTour ? dernierTour.publieA : resultats.maintenant)}
              </strong>
              , heure de Paris
            </span>
            <span>
              Source :{" "}
              <a
                href={dernierTour?.sourceUrl ?? resultats.source}
                className={classes.lienSource}
                rel="noopener"
              >
                ministère de l'Intérieur
              </a>
            </span>
            {publie ? (
              <span className={classes.avertissement}>
                <Info aria-hidden="true" />
                Résultats provisoires, sous réserve des décisions du juge de l'élection
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {resultats && circoResultats && !publie && jourJ ? (
        <AttenteResultats
          resultats={resultats}
          maintenant={resultats.maintenant}
          nbListes={listesCandidats.length}
          sortantsCandidats={sortantsCandidats}
          nbSortants={liste.length}
        />
      ) : null}

      {resultats && publie && proportionnel && premierTour ? (
        <>
          <div className={classes.deuxColonnesLg}>
            {premierTour.lignes[0] ? (
              <ListeEnTete
                ligne={premierTour.lignes[0]}
                nbSieges={nbSieges}
                autres={premierTour.lignes.slice(1).filter((l) => (l.sieges ?? 0) > 0)}
              />
            ) : null}
            <CarteElus elus={resultats.elus} ou={ou} nbSieges={nbSieges} resteAPourvoir={0} />
          </div>
          <ResultatsParListe tour={premierTour} nbSieges={nbSieges} />
          {resultats.repartition ? (
            <RepartitionSieges repartition={resultats.repartition} nbSieges={nbSieges} />
          ) : null}
          <BlocParticipation
            participation={premierTour.participation}
            titre="Participation des grands électeurs"
            large
          />
          <ListesEtCandidats tour={premierTour} />
        </>
      ) : null}

      {resultats && circoResultats && publie && !proportionnel ? (
        <>
          <CarteElus
            elus={resultats.elus}
            ou={ou}
            nbSieges={nbSieges}
            resteAPourvoir={secondTour ? 0 : nbSieges - resultats.elus.length}
            horaireSecondTour={
              circoResultats.horaires.ouvertureT2 && circoResultats.horaires.clotureT2
                ? `de ${heureDeParis(circoResultats.horaires.ouvertureT2)} à ${heureDeParis(circoResultats.horaires.clotureT2)}, heure de Paris`
                : undefined
            }
          />
          {secondTour ? <TourMajoritaire tour={secondTour} rappel={false} /> : null}
          {premierTour ? <TourMajoritaire tour={premierTour} rappel={Boolean(secondTour)} /> : null}
          {secondTour ? (
            <div className={classes.deuxColonnesLg}>
              <BlocParticipation
                participation={secondTour.participation}
                titre="Participation au 2nd tour"
              />
              {premierTour ? (
                <BlocParticipation
                  participation={premierTour.participation}
                  titre="Participation au 1er tour"
                />
              ) : null}
            </div>
          ) : premierTour ? (
            <BlocParticipation
              participation={premierTour.participation}
              titre="Participation au 1er tour"
              large
            />
          ) : null}
        </>
      ) : null}

      <section className={classes.encadre} aria-labelledby="deroulement">
        <h2 id="deroulement" className={classes.h2Encadre}>
          Comment se déroule le scrutin {ou} ?
        </h2>
        <div className={classes.texteEncadre}>
          <p>{scrutinLocal.phrase}</p>
          <p>
            Les électeurs ne sont pas les habitants du département mais un collège de{" "}
            <strong>grands électeurs</strong> — députés, conseillers régionaux et départementaux, et
            surtout délégués des conseils municipaux, qui forment près de 95 % du collège.
          </p>
          <p>
            Les élus prennent leurs fonctions le <strong>1er octobre 2026</strong>, pour un mandat
            de six ans.
          </p>
        </div>
      </section>

      {candidatsQuery.isError ? (
        <ErrorState
          message="Les candidatures n'ont pas pu être chargées."
          onRetry={() => void candidatsQuery.refetch()}
        />
      ) : null}

      {candidaturesPubliees && !publie ? (
        <section className={classes.pile} aria-labelledby="candidats">
          <div>
            <h2 id="candidats" className={classes.h2}>
              {nbCandidats} {pluriel(nbCandidats, "candidat")} {ou}
            </h2>
            <p className={classes.mentionPetite}>
              {listesCandidats.length}{" "}
              {scrutinLocal.unite === "liste"
                ? `${pluriel(listesCandidats.length, "liste")} en lice pour ${nbSieges} ${pluriel(nbSieges, "siège")}`
                : `${pluriel(listesCandidats.length, "candidature")} pour ${nbSieges} ${pluriel(nbSieges, "siège")}`}
              . Les noms en couleur renvoient vers le bilan parlementaire de la personne.
            </p>
          </div>
          <ul className={classes.grilleCartes} data-serre>
            {listesCandidats.map((listeCandidature) => (
              <li key={listeCandidature.id}>
                <ListeCandidatureCard liste={listeCandidature} />
              </li>
            ))}
          </ul>
          <p className={classes.notePetite}>
            Source : candidatures déposées en préfecture, publiées par le ministère de l'Intérieur.
            La nuance politique est attribuée par l'administration et ne présume pas de
            l'appartenance déclarée du candidat.
          </p>
        </section>
      ) : null}

      <section className={classes.pile} aria-labelledby="sortants">
        <div>
          <h2 id="sortants" className={classes.h2}>
            {publie
              ? `Le sort ${liste.length > 1 ? `des ${liste.length} sénateurs sortants` : "du sénateur sortant"}`
              : `${liste.length} ${pluriel(liste.length, "sénateur")} ${pluriel(liste.length, "sortant")} ${ou}`}
          </h2>
          {publie ? (
            <p className={classes.mentionPetite}>
              Leur bilan de mandature, arrêté à la veille du scrutin.
            </p>
          ) : null}
        </div>
        {sortantsQuery.isPending ? (
          <LoadingState label="Chargement des sortants…" variant="skeleton" lines={4} />
        ) : sortantsQuery.isError ? (
          <ErrorState
            message="Une erreur est survenue lors du chargement des sortants."
            onRetry={() => void sortantsQuery.refetch()}
          />
        ) : liste.length > 0 ? (
          <ul className={classes.grilleCartes} data-serre>
            {liste.map((sortant) => (
              <li key={sortant.mandatId}>
                <SortantCard
                  sortant={sortant}
                  candidaturesPubliees={candidaturesPubliees}
                  sort={publie ? sortDuSortant.get(sortant.mandatId) : undefined}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className={classes.mentionPetite}>
            Le bilan de mandature des sortants de cette circonscription n'est pas encore disponible.
          </p>
        )}
      </section>

      <div className={classes.pied}>
        <Link href="/senatoriales-2026">
          Voir les {nbCirconscriptions} départements concernés par le renouvellement
        </Link>
      </div>

      <EncartSoutien />
    </Container>
  );
};
