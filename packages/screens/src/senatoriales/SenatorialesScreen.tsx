"use client";

import { useApiQuery } from "@clair/api-client";
import type {
  ApercuSenatoriales,
  ListeSortants,
  ResultatsNationaux,
  Sortant,
  TriSortants,
} from "@clair/data";
import {
  Button,
  buildHref,
  Container,
  ErrorState,
  FilterBar,
  Link,
  LoadingState,
  SearchInput,
  useNavigation,
} from "@clair/ui";
import { NativeSelect } from "@mantine/core";
import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { ScreenProps } from "../shared/types.ts";
import { CadreGraphique } from "./composants/CadreGraphique.tsx";
import { IndexCirconscriptions } from "./composants/IndexCirconscriptions.tsx";
import { SelecteurLecture } from "./composants/PastillesLecture.tsx";
import { RepartitionGroupes } from "./composants/RepartitionGroupes.tsx";
import { SortantCard } from "./composants/SortantCard.tsx";
import { BarresComptage, type Selection } from "./graphiques/BarresComptage.tsx";
import { CarteDepartements } from "./graphiques/CarteDepartements.tsx";
import { DistributionBilan } from "./graphiques/DistributionBilan.tsx";
import { NuageActivite } from "./graphiques/NuageActivite.tsx";
import { PartRemiseEnJeu } from "./graphiques/PartRemiseEnJeu.tsx";
import { PyramideAges } from "./graphiques/PyramideAges.tsx";
import { compteARebours, SIEGES_SENAT } from "./lib/calendrier.ts";
import { COULEUR_SECONDAIRE } from "./lib/couleurs.ts";
import { slugDepuisCode } from "./lib/departements.ts";
import { nomGroupe } from "./lib/format.ts";
import {
  familleProfession,
  GRAPHIQUE_PAR_TRI,
  GRAPHIQUES,
  parCommission,
  parFamilleProfession,
  repartitionParGroupe,
  SANS_COMMISSION,
  SANS_PROFESSION,
  siegesParDepartement,
} from "./lib/graphiques.ts";
import { scrutinCommence } from "./lib/resultats.ts";
import { indexerPar, rechercherSortants, sectionsDeSortants } from "./lib/sortants.ts";
import {
  parseSenatorialesParams,
  type SenatorialesParams,
  senatorialesParamsOf,
  sortantsQueryOf,
} from "./params.ts";
import { BlocResultatsNationaux } from "./resultats/BlocResultatsNationaux.tsx";
import classes from "./Senatoriales.module.css";

/** Données chargées par la route pour les filtres de l'URL. */
export type SenatorialesInitial = {
  apercu?: ApercuSenatoriales;
  sortants?: ListeSortants;
  /**
   * Les 178 sortants sans filtre, pour la carte, qui décrit toujours le renouvellement entier.
   * Absente quand `sortants` n'est lui-même pas restreint : il ferait voyager deux fois la liste.
   */
  tousSortants?: Sortant[];
};

export type SenatorialesScreenProps = ScreenProps<SenatorialesInitial> & {
  /**
   * Résultats du ministère, chargés par la route (cache d'une minute) et rechargés par elle
   * pendant le direct. `null` si l'API ne répond pas : la page reste celle d'avant le scrutin.
   */
  resultats?: ResultatsNationaux | null;
};

const BlocSquelette = () => (
  <LoadingState label="Chargement des sénatoriales…" variant="skeleton" lines={8} />
);

/** Le graphique qu'appelle le tri courant, calculé sur la sélection affichée en dessous. */
const graphiqueDuTri = (
  tri: TriSortants,
  sortants: Sortant[],
  apercu: ApercuSenatoriales,
  onSelection: Selection,
): ReactNode => {
  switch (tri) {
    case "groupe":
      return (
        <PartRemiseEnJeu
          parGroupe={repartitionParGroupe(sortants, apercu.sortants.parGroupe)}
          sortants={sortants}
          onSelection={onSelection}
        />
      );
    case "commission":
      return (
        <BarresComptage
          donnees={parCommission(sortants)}
          total={sortants.length}
          sortantsParLabel={indexerPar(sortants, (s) => s.commissionPermanente ?? SANS_COMMISSION)}
          onSelection={onSelection}
          legende="Sortants par commission permanente"
        />
      );
    case "profession":
      return (
        <BarresComptage
          donnees={parFamilleProfession(sortants)}
          total={sortants.length}
          couleur={COULEUR_SECONDAIRE}
          sortantsParLabel={indexerPar(
            sortants,
            (s) => familleProfession(s.personne.profession) ?? SANS_PROFESSION,
          )}
          onSelection={onSelection}
          legende="Sortants par famille professionnelle"
        />
      );
    case "age":
      return <PyramideAges sortants={sortants} onSelection={onSelection} />;
    case "presence":
    case "loyaute":
      return <DistributionBilan sortants={sortants} metrique={tri} onSelection={onSelection} />;
    case "amendements":
    case "interventions":
      return <NuageActivite sortants={sortants} onSelection={onSelection} />;
    default:
      return null;
  }
};

/**
 * Page des sénatoriales du 27 septembre 2026 : résultats du scrutin dès le premier bureau
 * ouvert, fonctionnement de l'élection, candidatures, index des 64 circonscriptions, carte et
 * graphiques des sortants (un par lecture, dans l'URL : `?tri=`), filtres et liste des sortants
 * avec leur bilan de mandature. Remplace `app/senatoriales-2026/PageClient.tsx` de apps/web.
 */
export const SenatorialesScreen = ({
  params: rawParams,
  initialData,
  resultats = null,
}: SenatorialesScreenProps) => {
  const { navigate, pathname } = useNavigation();
  const params = parseSenatorialesParams(rawParams);
  const listeRef = useRef<HTMLDivElement>(null);
  const [compteur, setCompteur] = useState<string | null>(null);

  /**
   * Sortants désignés par un clic dans un graphique : la sélection surligne la liste sans la
   * filtrer. Elle vaut pour les filtres sous lesquels elle a été faite, et s'efface sinon.
   */
  const cleFiltres = JSON.stringify([params.tri, params.departement, params.groupe, params.search]);
  const [selection, setSelection] = useState<{
    ids: Set<string>;
    libelle: string;
    cle: string;
  } | null>(null);
  const surbrillance = selection?.cle === cleFiltres ? selection : null;

  // Le compte à rebours dépend de l'heure du lecteur : calculé après l'hydratation, comme
  // apps/web, pour que le rendu serveur et le navigateur ne divergent pas.
  useEffect(() => {
    setCompteur(compteARebours(new Date()));
  }, []);

  const apercuQuery = useApiQuery<ApercuSenatoriales>(
    "/senatoriales/2026",
    {},
    { initialData: initialData?.apercu },
  );
  const sortantsQuery = useApiQuery<ListeSortants>(
    "/senatoriales/2026/sortants",
    sortantsQueryOf(params),
    { initialData: initialData?.sortants },
  );

  const mettreAJour = (patch: Partial<SenatorialesParams>) =>
    navigate(buildHref(pathname, senatorialesParamsOf({ ...params, ...patch })));

  /** Amène la liste sous les yeux après une action faite plus haut (une image plus tard). */
  const glisserVersListe = () => {
    requestAnimationFrame(() => {
      listeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const selectionnerDepartement = (code: string) => {
    setSelection(null);
    mettreAJour({ departement: code });
    if (code) glisserVersListe();
  };

  const selectionnerDepuisGraphique: Selection = (mandatIds, libelle) => {
    if (mandatIds.length === 0) return;
    setSelection({ ids: new Set(mandatIds), libelle, cle: cleFiltres });
    glisserVersListe();
  };

  const entete = (description: ReactNode) => (
    <div className={classes.entete}>
      <h1 className={classes.h1}>Sénatoriales du 27 septembre 2026</h1>
      {description}
      {compteur ? <p className={classes.compteur}>{compteur}</p> : null}
    </div>
  );

  if (apercuQuery.isError) {
    return (
      <Container className={classes.page}>
        {entete(null)}
        <ErrorState
          message="Une erreur est survenue lors du chargement des données."
          onRetry={() => void apercuQuery.refetch()}
        />
      </Container>
    );
  }

  if (apercuQuery.isPending) {
    return (
      <Container className={classes.page}>
        {entete(null)}
        <BlocSquelette />
      </Container>
    );
  }

  const apercu = apercuQuery.data;
  const { scrutin, sortants: apercuSortants, circonscriptions } = apercu;
  const candidatures = apercu.candidatures ?? null;
  const candidaturesPubliees = candidatures !== null;

  const sortants = sortantsQuery.data?.data ?? [];
  const serveurNonFiltre = !params.departement && !params.groupe;
  const tousSortants = initialData?.tousSortants?.length
    ? initialData.tousSortants
    : serveurNonFiltre && initialData?.sortants?.data.length
      ? initialData.sortants.data
      : sortants;

  const filtresActifs = [params.search, params.departement, params.groupe].filter(Boolean).length;
  const affiches = rechercherSortants(sortants, params.search);
  const tri: TriSortants = params.tri || "departement";
  const sections = sectionsDeSortants(affiches, tri);

  const slugContextuel = GRAPHIQUE_PAR_TRI[tri];
  const contenuContextuel =
    slugContextuel && slugContextuel !== "carte" && affiches.length > 0
      ? graphiqueDuTri(tri, affiches, apercu, selectionnerDepuisGraphique)
      : null;

  const carteSortant = (sortant: Sortant) => (
    <li key={sortant.mandatId}>
      <SortantCard
        sortant={sortant}
        surbrillance={surbrillance?.ids.has(sortant.mandatId)}
        candidaturesPubliees={candidaturesPubliees}
      />
    </li>
  );

  return (
    <Container className={classes.page}>
      {entete(
        <p className={classes.chapeau}>
          {scrutin.nbSieges} des {SIEGES_SENAT} sièges du Sénat sont renouvelés.
          {candidaturesPubliees
            ? " Les candidats, circonscription par circonscription, et le bilan de mandature des sortants."
            : " Voici le bilan de mandature des sortants."}
        </p>,
      )}

      {scrutinCommence(resultats) ? <BlocResultatsNationaux donnees={resultats} /> : null}

      <section className={classes.encadre} aria-labelledby="fonctionnement">
        <h2 id="fonctionnement" className={classes.h2Encadre}>
          Comment fonctionne une élection sénatoriale ?
        </h2>
        <div className={classes.texteEncadre}>
          <p>
            Les sénateurs sont élus au suffrage <strong>indirect</strong>, par environ 162 000
            grands électeurs (députés, conseillers régionaux et départementaux, et surtout délégués
            des conseils municipaux, qui forment près de 95 % du collège).
          </p>
          <p>
            Le Sénat se renouvelle <strong>par moitié tous les trois ans</strong>. Le 27 septembre
            2026, c'est la série 2 : {scrutin.nbSieges} sièges dans {scrutin.nbCirconscriptions}{" "}
            circonscriptions.
          </p>
          <p>
            Le mode de scrutin dépend du département : <strong>majoritaire à deux tours</strong> là
            où il y a un ou deux sièges, <strong>proportionnel de liste à un tour</strong> à partir
            de trois sièges.
          </p>
          <p>
            Les élus prennent leurs fonctions le <strong>1er octobre 2026</strong>. Le mandat dure
            six ans.
          </p>
        </div>
        {scrutin.sources.length > 0 ? (
          <ul className={classes.sources}>
            {scrutin.sources.map((source) => (
              <li key={source.label}>
                {source.url ? (
                  <Link href={source.url} external>
                    {source.label}
                  </Link>
                ) : (
                  <span className={classes.mention}>{source.label}</span>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <dl className={classes.chiffres}>
        {(
          [
            [scrutin.nbSieges, "sièges renouvelés"],
            [scrutin.nbCirconscriptions, "départements concernés"],
            [SIEGES_SENAT - scrutin.nbSieges, "sièges non concernés"],
          ] as const
        ).map(([valeur, libelle]) => (
          <div key={libelle} className={classes.chiffre}>
            <dt className={classes.chiffreLibelle}>{libelle}</dt>
            <dd className={`${classes.chiffreValeur} clair-chiffres`}>
              {valeur.toLocaleString("fr-FR")}
            </dd>
          </div>
        ))}
      </dl>

      {candidatures ? (
        <section className={classes.encadre} aria-labelledby="remise-en-jeu">
          <h2 id="remise-en-jeu" className={classes.h2}>
            Qui remet son siège en jeu ?
          </h2>
          <dl className={classes.chiffresCandidatures}>
            <div>
              <dt className={classes.chiffreLibelle}>
                sortants sur {apercuSortants.total} se représentent
              </dt>
              <dd className={`${classes.chiffreValeur} clair-chiffres`} data-accent>
                {candidatures.sortantsCandidats.toLocaleString("fr-FR")}
              </dd>
            </div>
            <div>
              <dt className={classes.chiffreLibelle}>quittent le Sénat</dt>
              <dd className={`${classes.chiffreValeur} clair-chiffres`}>
                {candidatures.sortantsNonCandidats.toLocaleString("fr-FR")}
              </dd>
            </div>
            <div>
              <dt className={classes.chiffreLibelle}>
                candidats au total, dans {candidatures.circonscriptions} circonscriptions
              </dt>
              <dd className={`${classes.chiffreValeur} clair-chiffres`}>
                {candidatures.candidats.toLocaleString("fr-FR")}
              </dd>
            </div>
          </dl>
          <p className={classes.mentionPetite}>
            {candidatures.anciensParlementaires > 0 ? (
              <>
                {candidatures.anciensParlementaires} autres candidats sont déjà passés par le
                Parlement : leur fiche et leur historique de vote sont consultables depuis la page
                de leur circonscription.{" "}
              </>
            ) : null}
            Source : fichier des candidatures du ministère de l'Intérieur.
          </p>
        </section>
      ) : null}

      <IndexCirconscriptions circonscriptions={circonscriptions} />

      <section aria-labelledby="repartition-groupes" className={classes.pile}>
        <h2 id="repartition-groupes" className={classes.h2}>
          Répartition des sièges sortants par groupe
        </h2>
        <RepartitionGroupes parGroupe={apercuSortants.parGroupe} total={apercuSortants.total} />
      </section>

      <CadreGraphique
        slug="carte"
        titre={GRAPHIQUES.carte.titre}
        sousTitre={GRAPHIQUES.carte.sousTitre}
        lienPageDediee
      >
        <CarteDepartements
          sieges={siegesParDepartement(tousSortants)}
          selection={params.departement}
          onSelect={selectionnerDepartement}
        />
      </CadreGraphique>

      <SelecteurLecture valeur={params.tri} onChange={(nouveau) => mettreAJour({ tri: nouveau })} />

      <FilterBar
        activeCount={filtresActifs}
        onReset={() => navigate(pathname)}
        search={
          <SearchInput
            aria-label="Rechercher un sortant"
            placeholder="Rechercher un sortant..."
            value={params.search}
            debounceMs={300}
            onChange={(search) => mettreAJour({ search })}
          />
        }
      >
        <NativeSelect
          label="Département"
          classNames={{ label: "clair-visually-hidden" }}
          className={classes.filtre}
          value={params.departement}
          onChange={(event) => mettreAJour({ departement: event.currentTarget.value })}
          data={[
            { value: "", label: "Tous les départements" },
            ...[...circonscriptions]
              .sort((a, b) => a.nom.localeCompare(b.nom))
              .map((c) => ({ value: c.departement, label: `${c.nom} (${c.nbSieges})` })),
          ]}
        />
        <NativeSelect
          label="Groupe"
          classNames={{ label: "clair-visually-hidden" }}
          className={classes.filtre}
          value={params.groupe}
          onChange={(event) => mettreAJour({ groupe: event.currentTarget.value })}
          data={[
            { value: "", label: "Tous les groupes" },
            ...apercuSortants.parGroupe.map((g) => ({
              value: g.slug,
              label: `${nomGroupe(g)} (${g.sieges})`,
            })),
          ]}
        />
      </FilterBar>

      {slugContextuel && contenuContextuel ? (
        <CadreGraphique
          slug={slugContextuel}
          titre={GRAPHIQUES[slugContextuel].titre}
          sousTitre={
            filtresActifs > 0
              ? `${GRAPHIQUES[slugContextuel].sousTitre} Calculé sur les ${affiches.length} sortants correspondant aux filtres.`
              : GRAPHIQUES[slugContextuel].sousTitre
          }
          lienPageDediee
        >
          {contenuContextuel}
        </CadreGraphique>
      ) : null}

      <div ref={listeRef} className={classes.liste}>
        {surbrillance ? (
          <div className={classes.surbrillance} role="status">
            <span>
              <strong>{surbrillance.libelle}</strong> — {surbrillance.ids.size} sortant
              {surbrillance.ids.size > 1 ? "s" : ""} surligné
              {surbrillance.ids.size > 1 ? "s" : ""} dans la liste
            </span>
            <Button variant="tertiaire" size="sm" icon={<X />} onClick={() => setSelection(null)}>
              Retirer la surbrillance
            </Button>
          </div>
        ) : null}

        {sortantsQuery.isPending ? (
          <LoadingState label="Chargement des sortants…" variant="skeleton" lines={6} />
        ) : sortantsQuery.isError ? (
          <ErrorState
            message="Une erreur est survenue lors du chargement des sortants."
            onRetry={() => void sortantsQuery.refetch()}
          />
        ) : affiches.length === 0 ? (
          <p className={classes.mentionPetite}>Aucun sortant ne correspond aux critères.</p>
        ) : sections ? (
          <div className={classes.sections}>
            {sections.map((section) => {
              const slug = tri === "departement" ? slugDepuisCode(section.cle) : undefined;
              const n = section.sortants.length;
              return (
                <section key={section.cle} id={section.ancre} className={classes.section}>
                  <h3 className={classes.h3}>
                    {slug ? (
                      <Link href={`/senatoriales-2026/${slug}`} className={classes.lienTitre}>
                        {section.libelle}
                      </Link>
                    ) : (
                      <a href={`#${section.ancre}`} className={classes.lienTitre}>
                        {section.libelle}
                      </a>
                    )}{" "}
                    · {n} siège{n > 1 ? "s" : ""}
                  </h3>
                  <ul className={classes.grilleCartes}>{section.sortants.map(carteSortant)}</ul>
                </section>
              );
            })}
          </div>
        ) : (
          <ul className={classes.grilleCartes}>{affiches.map(carteSortant)}</ul>
        )}
      </div>

      <div className={classes.methode}>
        <p>
          Les chiffres affichés sont ceux de la <strong>carrière au Sénat</strong> de chaque sortant
          : ce sont exactement ceux de sa fiche. Les taux de présence et de loyauté sont comparables
          entre eux ; les compteurs d'interventions et d'amendements le sont moins, un sénateur
          arrivé en cours de mandature ayant eu moins d'occasions de siéger — d'où le badge sur sa
          carte.
        </p>
        <p>
          Quelques mandats ont été exercés en plusieurs périodes, une entrée au gouvernement
          suspendant le mandat parlementaire. Ces sénateurs portent le badge{" "}
          <em>mandat interrompu</em> ; leurs chiffres couvrent bien l'ensemble de leur passage au
          Sénat, et non la seule période en cours.
        </p>
        <p>
          <Link href="/methodologie">En savoir plus sur la méthodologie</Link>
        </p>
      </div>
    </Container>
  );
};
