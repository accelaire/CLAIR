"use client";

import type {
  CandidatResultat,
  Elu,
  LigneResultat,
  Participation,
  ResultatsCirconscription,
  TourResultat,
} from "@clair/data";
import { Link } from "@clair/ui";
import { couleurFamille, libelleFamille } from "../lib/familles.ts";
import {
  accorder,
  heureDeParis,
  lienPersonne,
  nombre,
  pluriel,
  pourcentage,
} from "../lib/format.ts";
import { libelleParcours, lienElu, OUTRE_MER } from "../lib/resultats.ts";
import classes from "./Resultats.module.css";

/**
 * Blocs de la page de résultats d'une circonscription (repris de apps/web). Les listes non élues
 * se replient dans un `<details>`, qui fonctionne sans script. Résultats officiels provisoires.
 */

const Pastille = ({ famille }: { famille: string | null }) => (
  <span
    className={classes.pastilleFamille}
    style={{ backgroundColor: couleurFamille(famille) }}
    title={libelleFamille(famille)}
    aria-hidden="true"
  />
);

const Initiales = ({ prenom, nom }: { prenom: string; nom: string }) => (
  <span className={classes.initiales} aria-hidden="true">
    {`${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase()}
  </span>
);

const Points = ({ n, famille, total }: { n: number; famille: string | null; total?: number }) => (
  <span className={classes.pointsSieges} aria-hidden="true">
    {Array.from({ length: total ?? n }).map((_, i) => (
      <span
        key={i}
        className={classes.pointSiege}
        data-vide={i >= n || undefined}
        style={i < n ? { backgroundColor: couleurFamille(famille) } : undefined}
      />
    ))}
  </span>
);

// --- En tête ----------------------------------------------------------------

export const ListeEnTete = ({
  ligne,
  nbSieges,
  autres,
}: {
  ligne: LigneResultat;
  nbSieges: number;
  /** Les autres listes qui ont obtenu des sièges. */
  autres: LigneResultat[];
}) => {
  const tete = ligne.candidats.find((c) => c.ordre === 1 && c.role === "titulaire");
  const sieges = ligne.sieges ?? 0;
  return (
    <section className={classes.carte}>
      <p className={classes.surtitre}>Liste arrivée en tête</p>
      <div className={classes.ligneFamille} data-marge>
        <Pastille famille={ligne.famille} />
        <div>
          <h2 className={classes.titreListe}>{ligne.libelle}</h2>
          <p className={classes.texteMention}>
            {ligne.nuanceLibelle ?? libelleFamille(ligne.famille)}
            {tete ? (
              <>
                {" · menée par "}
                {tete.personne ? (
                  <Link href={lienPersonne(tete.personne)}>
                    {tete.prenom} {tete.nom}
                  </Link>
                ) : (
                  `${tete.prenom} ${tete.nom}`
                )}
              </>
            ) : null}
          </p>
        </div>
      </div>
      <div className={classes.chiffresTete}>
        <div>
          <p className={`${classes.grandChiffre} clair-chiffres`}>
            {pourcentage(ligne.pctExprimes)}
          </p>
          <p className={classes.petit}>{nombre(ligne.voix)} voix</p>
        </div>
        {sieges > 0 ? (
          <div>
            <Points n={sieges} famille={ligne.famille} total={nbSieges} />
            <p className={classes.petit}>
              {ligne.sieges} {pluriel(sieges, "siège")} sur {nbSieges}
            </p>
          </div>
        ) : null}
      </div>
      {autres.length > 0 ? (
        <p className={classes.texteMention} data-marge>
          {autres.map((a, i) => (
            <span key={a.sourceUid}>
              {i > 0 ? ", " : null}
              <strong className={classes.fort}>{a.libelle}</strong> {a.sieges}{" "}
              {pluriel(a.sieges ?? 0, "siège")}
            </span>
          ))}
          .
        </p>
      ) : null}
    </section>
  );
};

// --- Élus -------------------------------------------------------------------

export const CarteElus = ({
  elus,
  ou,
  nbSieges,
  resteAPourvoir,
  horaireSecondTour,
}: {
  elus: Elu[];
  ou: string;
  nbSieges: number;
  /** Sièges encore à pourvoir au 2nd tour (majoritaire, résultats partiels). */
  resteAPourvoir: number;
  /** « de 15h30 à 17h30, heure de Paris » */
  horaireSecondTour?: string;
}) => (
  <section className={classes.carte}>
    <div className={classes.blocEntete}>
      <h2 className={classes.titreBloc}>
        {elus.length === nbSieges
          ? `${elus.length > 1 ? `Les ${elus.length} élus` : accorder(elus[0]?.sexe, "L'élu", "L'élue")} ${ou}`
          : `${elus.length} ${pluriel(elus.length, "élu")} sur ${nbSieges} ${ou}`}
      </h2>
      <p className={classes.petit}>Prise de fonction le 1er octobre</p>
    </div>
    {elus.some((e) => !e.personne && e.slug) ? (
      <p className={classes.petit}>
        Chaque nom mène à sa fiche : le bilan parlementaire des sortants et des anciens
        parlementaires, les mandats locaux des nouveaux élus.
      </p>
    ) : null}
    <ul className={classes.elus}>
      {elus.map((e) => {
        const lien = lienElu(e);
        const mandatPrincipal = !e.personne ? e.mandatsLocaux?.mandats[0]?.libelle : undefined;
        return (
          <li key={`${e.nom}-${e.prenom}`} className={classes.elu}>
            <Initiales prenom={e.prenom} nom={e.nom} />
            <div className={classes.eluTexte}>
              <p className={classes.eluNom}>
                {lien ? (
                  <Link href={lien}>
                    {e.prenom} {e.nom}
                  </Link>
                ) : (
                  <span>
                    {e.prenom} {e.nom}
                  </span>
                )}
                <span
                  className={classes.etiquette}
                  data-ton={e.parcours === "nouveau" ? "contour" : "info"}
                >
                  {libelleParcours(e)}
                </span>
              </p>
              <p className={classes.petit}>
                {[
                  e.liste,
                  e.nuanceLibelle ?? libelleFamille(e.famille),
                  e.tour === 2 ? accorder(e.sexe, "élu au 2nd tour", "élue au 2nd tour") : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {mandatPrincipal ? <p className={classes.petit}>{mandatPrincipal}</p> : null}
            </div>
          </li>
        );
      })}
      {resteAPourvoir > 0 ? (
        <li className={`${classes.elu} ${classes.texteMention}`}>
          {resteAPourvoir} {pluriel(resteAPourvoir, "siège reste", "sièges restent")} à pourvoir au
          2nd tour{horaireSecondTour ? `, ${horaireSecondTour}` : ""}.
        </li>
      ) : null}
    </ul>
  </section>
);

// --- Voix par liste (proportionnel) -----------------------------------------

export const ResultatsParListe = ({ tour, nbSieges }: { tour: TourResultat; nbSieges: number }) => {
  const max = Math.max(...tour.lignes.map((l) => l.pctExprimes ?? 0), 1);
  return (
    <section className={classes.carte}>
      <div className={classes.blocEntete}>
        <h2 className={classes.titreBloc}>Résultats par liste</h2>
        <p className={classes.petit}>
          Scrutin proportionnel, un tour · {nbSieges} {pluriel(nbSieges, "siège")}
        </p>
      </div>
      <div className={classes.defilement}>
        <table className={classes.tableau}>
          <caption className="clair-visually-hidden">
            Voix et sièges par liste, scrutin proportionnel
          </caption>
          <thead>
            <tr>
              <th scope="col" className={classes.colRang}>
                #
              </th>
              <th scope="col">Liste</th>
              <th scope="col" className={classes.colBarre}>
                <span className="clair-visually-hidden">Part des exprimés</span>
              </th>
              <th scope="col" data-numerique>
                % des exprimés
              </th>
              <th scope="col" data-numerique>
                Voix
              </th>
              <th scope="col" data-numerique>
                Sièges
              </th>
            </tr>
          </thead>
          <tbody>
            {tour.lignes.map((l, i) => {
              const sieges = l.sieges ?? 0;
              return (
                <tr key={l.sourceUid}>
                  <td className={`${classes.mention} clair-chiffres`}>{i + 1}</td>
                  <td>
                    <span className={classes.ligneFamille}>
                      <Pastille famille={l.famille} />
                      <span>
                        <span className={classes.nomListe}>{l.libelle}</span>
                        <span className={classes.petitBloc}>
                          {l.nuanceLibelle ?? libelleFamille(l.famille)}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className={classes.colBarre}>
                    <span className={classes.piste}>
                      <span
                        className={classes.remplissage}
                        data-sans-siege={sieges === 0 || undefined}
                        style={{
                          width: `${((l.pctExprimes ?? 0) / max) * 100}%`,
                          ...(sieges > 0 ? { backgroundColor: couleurFamille(l.famille) } : {}),
                        }}
                      />
                    </span>
                  </td>
                  <td data-numerique className={`${classes.fort} clair-chiffres`}>
                    {pourcentage(l.pctExprimes)}
                  </td>
                  <td data-numerique className={`${classes.mention} clair-chiffres`}>
                    {nombre(l.voix)}
                  </td>
                  <td data-numerique>
                    {sieges > 0 ? (
                      <>
                        <Points n={sieges} famille={l.famille} />
                        <span className="clair-visually-hidden">
                          {l.sieges} {pluriel(sieges, "siège")}
                        </span>
                      </>
                    ) : (
                      <span className={classes.mention}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

// --- Tours du majoritaire ---------------------------------------------------

export const TourMajoritaire = ({ tour, rappel }: { tour: TourResultat; rappel: boolean }) => (
  <section className={classes.carte}>
    <div className={classes.blocEntete}>
      <h2 className={classes.titreBloc}>
        {rappel
          ? "Rappel du 1er tour"
          : tour.tour === 1
            ? "Résultats du 1er tour"
            : "Résultats du 2nd tour"}
      </h2>
      <p className={classes.petit}>Publiés à {heureDeParis(tour.publieA)}, heure de Paris</p>
    </div>
    <div className={classes.defilement}>
      <table className={classes.tableau}>
        <caption className="clair-visually-hidden">
          Voix par candidat, {tour.tour === 1 ? "1er" : "2nd"} tour
        </caption>
        <thead>
          <tr>
            <th scope="col">Candidat</th>
            <th scope="col" data-numerique>
              % des exprimés
            </th>
            <th scope="col" data-numerique>
              Voix
            </th>
            <th scope="col" data-numerique>
              Élu
            </th>
          </tr>
        </thead>
        <tbody>
          {tour.lignes.map((l) => {
            const titulaire = l.candidats.find((c) => c.role === "titulaire");
            const remplacant = l.candidats.find((c) => c.role === "suppleant");
            return (
              <tr key={l.sourceUid}>
                <td>
                  <span className={classes.ligneFamille}>
                    <Pastille famille={l.famille} />
                    <span>
                      <span className={classes.nomListe}>
                        {titulaire?.personne ? (
                          <Link href={lienPersonne(titulaire.personne)}>{l.libelle}</Link>
                        ) : (
                          l.libelle
                        )}
                        {titulaire?.sortant ? (
                          <span className={classes.etiquette} data-ton="info">
                            {accorder(titulaire.sexe, "sortant", "sortante")}
                          </span>
                        ) : null}
                      </span>
                      <span className={classes.petitBloc}>
                        {l.nuanceLibelle ?? libelleFamille(l.famille)}
                        {remplacant
                          ? ` · remplaçant${remplacant.sexe === "F" ? "e" : ""} : ${remplacant.prenom} ${remplacant.nom}`
                          : ""}
                      </span>
                    </span>
                  </span>
                </td>
                <td data-numerique className={`${classes.fort} clair-chiffres`}>
                  {pourcentage(l.pctExprimes)}
                </td>
                <td data-numerique className={`${classes.mention} clair-chiffres`}>
                  {nombre(l.voix)}
                </td>
                <td data-numerique>
                  {l.elu ? (
                    <span className={classes.etiquette} data-ton="inverse">
                      {accorder(titulaire?.sexe, "élu", "élue")}
                    </span>
                  ) : (
                    <span className={classes.mention}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    {tour.tour === 1 && !rappel && tour.lignes.some((l) => l.candidats.length > 0) ? (
      <p className={classes.petit}>
        Est élu au 1er tour le candidat qui réunit la majorité absolue des suffrages exprimés et le
        quart des inscrits. Chaque grand électeur vote pour autant de noms que de sièges : la somme
        des voix peut dépasser le nombre d'exprimés.
      </p>
    ) : null}
  </section>
);

// --- Répartition des sièges (proportionnel) ---------------------------------

export const RepartitionSieges = ({
  repartition,
  nbSieges,
}: {
  repartition: NonNullable<ResultatsCirconscription["repartition"]>;
  nbSieges: number;
}) => {
  const dernier = repartition.attributions[repartition.attributions.length - 1];
  const moyenneDernier = dernier
    ? (repartition.listes.find((l) => l.sourceUid === dernier.sourceUid)?.moyennes[
        dernier.diviseur - 1
      ] ?? 0)
    : 0;
  const avecSiege = repartition.listes.filter((l) => l.sieges > 0);
  const premiereSansSiege = repartition.listes
    .filter((l) => l.sieges === 0)
    .sort((a, b) => b.voix - a.voix)[0];
  const lignes = premiereSansSiege ? [...avecSiege, premiereSansSiege] : avecSiege;
  const rangDe = (uid: string, diviseur: number) =>
    repartition.attributions.find((a) => a.sourceUid === uid && a.diviseur === diviseur)?.rang;
  const colonnes = Math.min(nbSieges, Math.max(...avecSiege.map((l) => l.sieges), 1) + 1);
  const restantes = repartition.listes.length - lignes.length;

  return (
    <section className={classes.carte}>
      <h2 className={classes.titreBloc}>
        Comment{" "}
        {nbSieges > 1 ? `les ${nbSieges} sièges ont été répartis` : "le siège a été attribué"}
      </h2>
      <p className={classes.texteMention} data-marge>
        Règle de la plus forte moyenne : on divise les voix de chaque liste par 1, 2, 3… et on
        attribue les sièges aux plus grands résultats.
        {premiereSansSiege && dernier ? (
          <>
            {" "}
            Le dernier siège s'est joué à {nombre(moyenneDernier)} contre{" "}
            {nombre(premiereSansSiege.voix)} pour {premiereSansSiege.libelle} (en pointillés).
          </>
        ) : null}
      </p>
      <div className={classes.defilement}>
        <table className={classes.tableau} data-largeur-min>
          <caption className="clair-visually-hidden">
            Moyennes de chaque liste par diviseur, et rang des sièges attribués
          </caption>
          <thead>
            <tr>
              <th scope="col">Liste</th>
              {Array.from({ length: colonnes }).map((_, k) => (
                <th key={k} scope="col" data-numerique>
                  ÷ {k + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.sourceUid}>
                <th scope="row">
                  <span className={classes.ligneFamille}>
                    <Pastille famille={l.famille} />
                    <span>{l.libelle}</span>
                  </span>
                </th>
                {Array.from({ length: colonnes }).map((_, k) => {
                  const rang = rangDe(l.sourceUid, k + 1);
                  const valeur = l.moyennes[k] ?? 0;
                  const candidateSuivante = l === premiereSansSiege && k === 0;
                  return (
                    <td key={k} data-numerique className="clair-chiffres">
                      {rang ? (
                        <span className={classes.moyenneElue}>
                          <span className={classes.moyenneValeur}>{nombre(valeur)}</span>
                          <span className={classes.moyenneRang}>
                            {rang}
                            {rang === 1 ? "er" : "e"} siège
                          </span>
                        </span>
                      ) : candidateSuivante ? (
                        <span className={classes.moyenneSuivante}>
                          {nombre(valeur)}
                          <span className="clair-visually-hidden">
                            {" "}
                            (première moyenne sans siège)
                          </span>
                        </span>
                      ) : (
                        <span className={classes.mention}>{nombre(valeur)}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {restantes > 0 ? (
        <p className={classes.petit}>
          {restantes === 1 ? "L'autre liste" : `Les ${restantes} autres listes`}, qui{" "}
          {restantes === 1 ? "a" : "ont"} moins de voix,{" "}
          {restantes === 1 ? "n'est pas détaillée" : "ne sont pas détaillées"} : aucune de leurs
          moyennes n'approche le dernier siège.
        </p>
      ) : null}
    </section>
  );
};

// --- Participation ----------------------------------------------------------

export const BlocParticipation = ({
  participation: p,
  titre,
  large = false,
}: {
  participation: Participation;
  titre: string;
  /** Pleine largeur : les six chiffres sur une ligne. */
  large?: boolean;
}) => {
  const taux = p.inscrits > 0 ? (p.votants / p.inscrits) * 100 : null;
  const cases = [
    { valeur: nombre(p.inscrits), libelle: "inscrits" },
    { valeur: nombre(p.votants), libelle: `votants · ${pourcentage(taux)}` },
    { valeur: nombre(p.abstentions), libelle: "abstentions" },
    { valeur: nombre(p.blancs), libelle: "blancs" },
    { valeur: nombre(p.nuls), libelle: "nuls" },
    { valeur: nombre(p.exprimes), libelle: "exprimés" },
  ];
  return (
    <section className={classes.carte}>
      <h2 className={classes.titreBloc}>{titre}</h2>
      <p className={classes.texteMention} data-marge>
        Le vote est obligatoire pour les grands électeurs : une abstention sans motif légitime est
        passible d'une amende de 100 €. D'où des taux proches de 100 %.
      </p>
      <dl className={classes.participation} data-large={large || undefined}>
        {cases.map((c) => (
          <div key={c.libelle}>
            <dt className={classes.participationLibelle}>{c.libelle}</dt>
            <dd className={`${classes.participationValeur} clair-chiffres`}>{c.valeur}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

// --- Listes et candidats, avec la ligne de flottaison -----------------------

const CandidatLigne = ({ c }: { c: CandidatResultat }) => (
  <li className={classes.candidatLigne}>
    <span className={`${classes.rang} clair-chiffres`}>{c.ordre}</span>
    <span className={classes.candidatTexte}>
      <span className={classes.candidatNom}>
        {c.personne ? (
          <Link href={lienPersonne(c.personne)}>
            {c.prenom} {c.nom}
          </Link>
        ) : (
          <span className={c.elu ? classes.fort : undefined}>
            {c.prenom} {c.nom}
          </span>
        )}
        {c.sortant ? (
          <span className={classes.etiquette} data-ton="info">
            {accorder(c.sexe, "sortant", "sortante")}
          </span>
        ) : null}
        {c.elu ? (
          <span className={classes.etiquette} data-ton="inverse">
            {accorder(c.sexe, "élu", "élue")}
          </span>
        ) : null}
      </span>
      <span className={classes.petitBloc}>
        {[
          c.profession,
          c.anneeNaissance ? `${accorder(c.sexe, "né", "née")} en ${c.anneeNaissance}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </span>
  </li>
);

export const ListesEtCandidats = ({ tour }: { tour: TourResultat }) => {
  const elues = tour.lignes.filter((l) => (l.sieges ?? 0) > 0);
  const autres = tour.lignes.filter((l) => (l.sieges ?? 0) === 0);
  return (
    <section className={classes.pile}>
      <div>
        <h2 className={classes.titreBloc}>Les {tour.lignes.length} listes et leurs candidats</h2>
        <p className={classes.texteMention}>
          Classées par voix. Dans chaque liste, les noms au-dessus de la ligne de flottaison sont
          élus, dans l'ordre de la liste.
        </p>
      </div>
      <div className={classes.grilleListes}>
        {elues.map((l) => {
          const titulaires = l.candidats.filter((c) => c.role === "titulaire");
          const n = l.sieges ?? 0;
          return (
            <article key={l.sourceUid} className={classes.carteListe}>
              <div className={classes.ligneFamille}>
                <Pastille famille={l.famille} />
                <div>
                  <h3 className={classes.titreCarte}>{l.libelle}</h3>
                  <p className={classes.texteMention}>
                    {l.nuanceLibelle ?? libelleFamille(l.famille)}
                  </p>
                  <p className={classes.resumeListe}>
                    <strong className={classes.fort}>{pourcentage(l.pctExprimes)}</strong>
                    <span className={classes.mention}>
                      {" "}
                      · {nombre(l.voix)} voix · {n} {pluriel(n, "siège")}
                    </span>
                  </p>
                </div>
              </div>
              <ol className={classes.candidatsListe}>
                {titulaires.slice(0, n).map((c) => (
                  <CandidatLigne key={`${c.ordre}-${c.nom}`} c={c} />
                ))}
                <li className={classes.flottaison} aria-hidden="true">
                  <span />
                  ligne de flottaison · {n} {pluriel(n, "élu")}
                  <span />
                </li>
                {titulaires.slice(n).map((c) => (
                  <CandidatLigne key={`${c.ordre}-${c.nom}`} c={c} />
                ))}
              </ol>
            </article>
          );
        })}
      </div>
      <div className={classes.pileSerree}>
        {autres.map((l) => {
          const sortants = l.candidats.filter((c) => c.sortant);
          const titulaires = l.candidats.filter((c) => c.role === "titulaire");
          return (
            <details key={l.sourceUid} className={classes.repli}>
              <summary className={classes.repliResume}>
                <span className={classes.ligneFamille}>
                  <Pastille famille={l.famille} />
                  <span>
                    <span className={classes.nomListe}>{l.libelle}</span>
                    <span className={classes.texteMention}>
                      {l.nuanceLibelle ?? libelleFamille(l.famille)} · {pourcentage(l.pctExprimes)}{" "}
                      · aucun élu
                      {sortants.length > 0
                        ? ` · dont ${sortants.length} ${pluriel(sortants.length, "sortant")} : ${sortants
                            .map((s) => `${s.prenom} ${s.nom}`)
                            .join(", ")}`
                        : ""}
                    </span>
                  </span>
                </span>
                <span className={classes.repliBouton}>Voir les {titulaires.length} candidats</span>
              </summary>
              <ol className={classes.repliContenu}>
                {titulaires.map((c) => (
                  <CandidatLigne key={`${c.ordre}-${c.nom}`} c={c} />
                ))}
              </ol>
            </details>
          );
        })}
      </div>
    </section>
  );
};

// --- Avant les résultats ----------------------------------------------------

export const AttenteResultats = ({
  resultats,
  maintenant,
  nbListes,
  sortantsCandidats,
  nbSortants,
}: {
  resultats: ResultatsCirconscription;
  maintenant: string;
  nbListes: number;
  sortantsCandidats: number;
  nbSortants: number;
}) => {
  const c = resultats.circonscription;
  const h = c.horaires;
  const t = new Date(maintenant).getTime();
  const proportionnel = c.modeScrutin === "proportionnel";
  const jalons = proportionnel
    ? [
        {
          heure: heureDeParis(h.ouverture),
          libelle: "Ouverture du scrutin",
          fait: t >= Date.parse(h.ouverture),
        },
        {
          heure: heureDeParis(h.cloture),
          libelle: "Clôture, début du dépouillement",
          fait: t >= Date.parse(h.cloture),
        },
        {
          heure: "en soirée",
          libelle: "Publication des résultats par le ministère de l'Intérieur",
          fait: false,
        },
      ]
    : [
        {
          heure: heureDeParis(h.ouverture),
          libelle: "Ouverture du 1er tour",
          fait: t >= Date.parse(h.ouverture),
        },
        {
          heure: heureDeParis(h.cloture),
          libelle: "Clôture du 1er tour",
          fait: t >= Date.parse(h.cloture),
        },
        {
          heure: `${heureDeParis(h.ouvertureT2 ?? h.cloture)} → ${heureDeParis(h.clotureT2 ?? h.cloture)}`,
          libelle: "2nd tour, si un siège reste à pourvoir",
          fait: h.clotureT2 !== null && t >= Date.parse(h.clotureT2),
        },
      ];
  const titre =
    c.statut === "pas_ouvert"
      ? `Le scrutin ouvre à ${heureDeParis(h.ouverture)}, heure de Paris`
      : c.statut === "vote_en_cours"
        ? `Le vote est en cours jusqu'à ${heureDeParis(h.cloture)}`
        : `Le scrutin est clos depuis ${heureDeParis(h.cloture)}`;
  const outreMer = (OUTRE_MER as readonly string[]).includes(c.departement);

  return (
    <div className={classes.attente}>
      <section className={classes.carte} data-colonnes="3">
        <h2 className={classes.titreBloc}>{titre}</h2>
        <p className={classes.texteMention} data-marge>
          {proportionnel
            ? "Les résultats seront publiés d'un bloc, pour toutes les listes, dans la soirée. Ils s'afficheront ici dès leur publication par le ministère de l'Intérieur."
            : "Les résultats du 1er tour sont attendus vers midi. Si tous les sièges ne sont pas pourvus, un 2nd tour a lieu l'après-midi. Ils s'afficheront ici dès leur publication par le ministère de l'Intérieur."}
        </p>
        <ol className={classes.jalons}>
          {jalons.map((j) => (
            <li key={j.libelle} className={classes.etape} data-etat={j.fait ? "fait" : "a_venir"}>
              <span className={classes.etapeRepere} aria-hidden="true">
                <span className={classes.etapePoint} />
                <span className={classes.etapeTrait} />
              </span>
              <span className={classes.etapeHeure}>{j.heure}</span>
              <span className={classes.etapeLibelle}>
                {j.libelle}
                <span className="clair-visually-hidden">{j.fait ? " (fait)" : " (à venir)"}</span>
              </span>
            </li>
          ))}
        </ol>
        {outreMer ? (
          <p className={classes.petit}>
            Horaires convertis en heure de Paris : les bureaux ouvrent et ferment à l'heure locale.
          </p>
        ) : null}
      </section>
      <section className={classes.carte} data-colonnes="2">
        <h2 className={classes.titreBloc}>Ce qui se joue</h2>
        <dl className={classes.enjeux}>
          <div>
            <dt className={classes.petit}>{pluriel(c.nbSieges, "siège")} à pourvoir</dt>
            <dd className={`${classes.chiffreMoyen} clair-chiffres`}>{c.nbSieges}</dd>
          </div>
          <div>
            <dt className={classes.petit}>
              {proportionnel
                ? `${pluriel(nbListes, "liste")} en lice`
                : pluriel(nbListes, "candidature")}
            </dt>
            <dd className={`${classes.chiffreMoyen} clair-chiffres`}>{nbListes}</dd>
          </div>
          {c.grandsElecteurs !== null ? (
            <div>
              <dt className={classes.petit}>grands électeurs</dt>
              <dd className={`${classes.chiffreMoyen} clair-chiffres`}>
                {nombre(c.grandsElecteurs)}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className={classes.petit}>sortants candidats</dt>
            <dd className={`${classes.chiffreMoyen} clair-chiffres`}>
              {sortantsCandidats} sur {nbSortants}
            </dd>
          </div>
        </dl>
        <p className={classes.petit}>
          {proportionnel
            ? "Scrutin proportionnel à un tour : pas de résultat intermédiaire à la mi-journée, contrairement aux départements au scrutin majoritaire."
            : "Scrutin majoritaire à deux tours, le même jour."}
        </p>
      </section>
    </div>
  );
};
