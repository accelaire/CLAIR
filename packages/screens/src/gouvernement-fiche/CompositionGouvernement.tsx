"use client";

import type { DomaineMinisteriel, GouvernementDetail, PosteMinisteriel } from "@clair/data";
import { Badge, Button } from "@clair/ui";
import { useEffect, useRef } from "react";
import { NomMembre, PortraitMembre } from "../shared/gouvernements/ElementsGouvernement.tsx";
import {
  dateCourte,
  dateLongue,
  type Etape,
  etapes as etapesDuGouvernement,
  libellePoste,
  natureEtape,
  parDomaine,
} from "../shared/gouvernements/gouvernements.ts";
import classes from "./GouvernementFicheScreen.module.css";

type Marque = "entree" | "mutation";

const MARQUES: Record<Marque, { texte: string; tone: "succes" | "info" }> = {
  entree: { texte: "Entrée", tone: "succes" },
  mutation: { texte: "Nouveau poste", tone: "info" },
};

/** Le bilan d'une étape dans la frise : « +3 −1 ↔2 », dit en toutes lettres aux lecteurs d'écran. */
const BilanEtape = ({ e }: { e: Etape }) => {
  if (e.nature === "nomination") return <span>{e.composition.length} membres</span>;
  const morceaux = [
    e.entrees.length > 0
      ? {
          signe: `+${e.entrees.length}`,
          mot: e.entrees.length > 1 ? "entrées" : "entrée",
          n: e.entrees.length,
          cle: "plus",
        }
      : null,
    e.sorties.length > 0
      ? {
          signe: `−${e.sorties.length}`,
          mot: e.sorties.length > 1 ? "départs" : "départ",
          n: e.sorties.length,
          cle: "moins",
        }
      : null,
    e.mutations.length > 0
      ? {
          signe: `↔${e.mutations.length}`,
          mot: e.mutations.length > 1 ? "changements de poste" : "changement de poste",
          n: e.mutations.length,
          cle: "mutation",
        }
      : null,
  ].filter((m) => m !== null);
  return (
    <span className={classes.bilanEtape}>
      {morceaux.map((m) => (
        <span key={m.cle} data-signe={m.cle}>
          <span aria-hidden="true">{m.signe}</span>
          <span className="clair-visually-hidden">
            {m.n} {m.mot}
          </span>
        </span>
      ))}
    </span>
  );
};

const Poste = ({ p, marque }: { p: PosteMinisteriel; marque: Marque | null }) => (
  <li className={classes.poste}>
    <PortraitMembre personne={p.membre} />
    <div className={classes.posteCorps}>
      <p className={classes.posteNom} data-delegue={p.rangProtocolaire >= 40 || undefined}>
        <NomMembre personne={p.membre} />
        {marque ? (
          <Badge tone={MARQUES[marque].tone} size="sm">
            {MARQUES[marque].texte}
          </Badge>
        ) : null}
      </p>
      <p className={classes.mention}>{libellePoste(p.qualite, p.intituleCourt, p.intitule)}</p>
    </div>
  </li>
);

export type CompositionGouvernementProps = {
  gouvernement: Pick<GouvernementDetail, "dateDebut" | "dateFin" | "enCours" | "postes">;
  domaines: readonly DomaineMinisteriel[];
  /** Date de l'étape choisie (`etape` de l'URL) ; vide ou inconnue : la dernière. */
  etape: string;
  /** Choisit une étape (date), ou revient à la dernière (`""`). */
  onEtape: (date: string) => void;
};

/**
 * La composition d'un gouvernement, étape par étape (reprise de `composition-gouvernement.tsx`
 * de apps/web) : la nomination puis chaque remaniement ou départ, dans une frise. Choisir une
 * étape montre la composition qui en résulte, ce qui a changé ce jour-là y étant marqué, et les
 * sortants à part. Sans choix, la dernière étape : la composition actuelle, ou finale.
 */
export const CompositionGouvernement = ({
  gouvernement,
  domaines,
  etape,
  onEtape,
}: CompositionGouvernementProps) => {
  const etapes = etapesDuGouvernement(gouvernement, gouvernement.postes);
  const derniere = etapes.length - 1;
  const trouve = etapes.findIndex((x) => x.date === etape);
  const choix = trouve === -1 ? derniere : trouve;
  const e = etapes[choix];

  // La frise s'ouvre sur l'étape choisie : sur un gouvernement à treize étapes, la dernière
  // serait hors champ, à droite.
  const frise = useRef<HTMLDivElement>(null);
  const selection = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const conteneur = frise.current;
    const bouton = selection.current;
    if (!conteneur || !bouton || choix < 0) return;
    conteneur.scrollLeft = bouton.offsetLeft - conteneur.clientWidth / 2 + bouton.clientWidth / 2;
  }, [choix]);

  if (!e) return <p className={classes.mention}>Aucun poste enregistré pour ce gouvernement.</p>;

  const changement = e.nature === "changement";
  const marques = new Map<string, Marque>([
    ...(changement ? e.entrees.map((p) => [p.uid, "entree"] as const) : []),
    ...e.mutations.map((p) => [p.uid, "mutation"] as const),
  ]);
  // Le Premier ministre est présenté dans la colonne de faits.
  const groupes = parDomaine(
    e.composition.filter((p) => p.rangProtocolaire !== 1),
    domaines,
  );
  const finale = gouvernement.enCours ? "actuelle" : "finale";
  const titre =
    choix === derniere
      ? `Composition ${finale}`
      : e.nature === "nomination"
        ? "Composition à la nomination"
        : `Composition au ${dateLongue(e.date)}`;

  return (
    <section className={classes.pile} aria-labelledby="titre-composition">
      <h2 id="titre-composition" className={classes.titreSection}>
        Composition et remaniements
      </h2>
      {etapes.length > 1 ? (
        <>
          <p className={classes.mention}>
            Choisissez une étape pour voir la composition qui en résulte.{" "}
            <span data-signe="plus">+ entrées</span>, <span data-signe="moins">− départs</span>,{" "}
            <span data-signe="mutation">↔ changements de poste</span>.
          </p>
          <div ref={frise} className={classes.frise}>
            <ol className={classes.friseListe} aria-label="Étapes du gouvernement">
              {etapes.map((x, i) => (
                <li key={x.date}>
                  <button
                    type="button"
                    ref={i === choix ? selection : undefined}
                    onClick={() => onEtape(i === derniere ? "" : x.date)}
                    aria-pressed={i === choix}
                    className={classes.etape}
                  >
                    <span className={classes.etapeNature}>{natureEtape(x)}</span>
                    <span className={classes.etapeDate}>{dateCourte(x.date)}</span>
                    <span className={classes.etapeBilan}>
                      <BilanEtape e={x} />
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </>
      ) : null}

      <div className={classes.pile}>
        <div>
          <h3 className={classes.sousTitre}>{titre}</h3>
          <p className={classes.mention}>
            {e.composition.length} membres au {dateLongue(e.date)}, rangés par domaine ; dans chaque
            domaine, les ministres d’abord. Le classement par domaine est celui de CLAIR.
          </p>
        </div>

        {changement && e.sorties.length > 0 ? (
          <div className={classes.sorties}>
            <p className={classes.fort}>Quittent le gouvernement</p>
            <ul className={classes.listeSimple}>
              {e.sorties.map((p) => (
                <li key={p.uid}>
                  <NomMembre personne={p.membre} />{" "}
                  <span className={classes.mentionEnLigne}>
                    {libellePoste(p.qualite, p.intituleCourt, p.intitule)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className={classes.domaines}>
          {groupes.map(({ domaine, postes }) => (
            <section
              key={domaine.cle}
              className={classes.domaine}
              aria-labelledby={`domaine-${domaine.cle}`}
            >
              <h4 id={`domaine-${domaine.cle}`} className={classes.domaineTitre}>
                {domaine.libelle}
              </h4>
              <ul className={classes.listeSimple}>
                {postes.map((p) => (
                  <Poste key={p.uid} p={p} marque={marques.get(p.uid) ?? null} />
                ))}
              </ul>
            </section>
          ))}
        </div>
        {choix !== derniere ? (
          <div>
            <Button variant="tertiaire" onClick={() => onEtape("")}>
              Revenir à la composition {finale}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
};
