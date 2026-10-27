"use client";

import type { ResultatsNationaux } from "@clair/data";
import { Info } from "lucide-react";
import { EnDirect } from "../composants/EnDirect.tsx";
import { heureDeParis } from "../lib/format.ts";
import {
  chapeauNational,
  directNational,
  resultatsComplets,
  resultatsPublies,
} from "../lib/resultats.ts";
import { BadgeEtat } from "./Etats.tsx";
import { GrilleCirconscriptions } from "./GrilleCirconscriptions.tsx";
import { HemicycleAvantApres } from "./HemicycleAvantApres.tsx";
import classes from "./Resultats.module.css";
import { SuiviScrutin } from "./SuiviScrutin.tsx";

/**
 * Les résultats en tête de la page des sénatoriales, du premier bureau ouvert jusqu'au dernier
 * siège attribué : l'état de la soirée, l'hémicycle avant et après, et les 64 circonscriptions.
 * Données officielles provisoires du ministère de l'Intérieur.
 */
export const BlocResultatsNationaux = ({ donnees }: { donnees: ResultatsNationaux }) => (
  <div id="resultats" className={classes.resultats}>
    <div className={classes.pile}>
      <p className={classes.chapeau}>{chapeauNational(donnees)}</p>
      <div className={classes.meta}>
        {directNational(donnees) ? <EnDirect /> : null}
        <BadgeEtat compteurs={donnees.compteurs} maintenant={donnees.maintenant} />
        <span>
          Mis à jour à{" "}
          <strong className={classes.fort}>
            {heureDeParis(donnees.verifieA ?? donnees.maintenant)}
          </strong>
          , heure de Paris
        </span>
        <span>
          Source :{" "}
          <a href={donnees.source} className={classes.lienSource} rel="noopener">
            ministère de l'Intérieur
          </a>
        </span>
        {resultatsPublies(donnees) ? (
          <span className={classes.avertissement}>
            <Info aria-hidden="true" />
            Résultats provisoires, sous réserve des décisions du juge de l'élection
          </span>
        ) : null}
      </div>
    </div>

    <SuiviScrutin donnees={donnees} />

    <HemicycleAvantApres
      avant={donnees.hemicycle.avant}
      apres={donnees.hemicycle.apres}
      notes={donnees.hemicycle.notes}
      complet={resultatsComplets(donnees)}
    />

    <GrilleCirconscriptions circonscriptions={donnees.circonscriptions} base="/senatoriales-2026" />
  </div>
);
