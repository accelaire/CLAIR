"use client";

import type { ScrutinDeReunion } from "@clair/data";
import { Button, formatDossierTitre, Link, parseStatut, StatutBadge } from "@clair/ui";
import { useState } from "react";
import { scrutinHref } from "../scrutins.ts";
import classes from "./ScrutinsDeSeance.module.css";

/** Scrutins affichés par texte avant « Voir les n autres ». */
const VISIBLES = 3;

type Groupe = { cle: string; dossier: ScrutinDeReunion["dossier"]; scrutins: ScrutinDeReunion[] };

/** Range les scrutins par texte, dans l'ordre où ils arrivent. */
export const grouperParDossier = (scrutins: ScrutinDeReunion[]): Groupe[] => {
  const groupes = new Map<string, Groupe>();
  for (const scrutin of scrutins) {
    const cle = scrutin.dossier?.uid ?? "sans-dossier";
    const groupe = groupes.get(cle) ?? { cle, dossier: scrutin.dossier, scrutins: [] };
    groupe.scrutins.push(scrutin);
    groupes.set(cle, groupe);
  }
  return [...groupes.values()];
};

/** Une ligne : verdict en texte, objet du vote (lien) et voix pour / contre. */
export const LigneDeScrutin = ({
  scrutin,
}: {
  scrutin: Pick<ScrutinDeReunion, "numero" | "titre" | "sort" | "chambre" | "session"> & {
    nombrePour: number;
    nombreContre: number;
  };
}) => {
  const statut = parseStatut(scrutin.sort);
  return (
    <li className={classes.ligne}>
      {statut ? <StatutBadge statut={statut} size="sm" /> : null}
      <Link href={scrutinHref(scrutin)} className={classes.titre}>
        Scrutin n° {scrutin.numero} : {scrutin.titre}
      </Link>
      <span className={`${classes.voix} clair-chiffres`}>
        {scrutin.nombrePour.toLocaleString("fr-FR")} pour,{" "}
        {scrutin.nombreContre.toLocaleString("fr-FR")} contre
      </span>
    </li>
  );
};

const GroupeDeScrutins = ({ groupe }: { groupe: Groupe }) => {
  const [tout, setTout] = useState(false);
  const visibles = tout ? groupe.scrutins : groupe.scrutins.slice(0, VISIBLES);
  const restants = groupe.scrutins.length - visibles.length;
  return (
    <li className={classes.groupe}>
      <p className={classes.dossier}>
        {groupe.dossier ? (
          <Link href={`/dossiers/${encodeURIComponent(groupe.dossier.uid)}`}>
            {formatDossierTitre(groupe.dossier.titre, groupe.dossier.procedureLibelle)}
          </Link>
        ) : (
          "Hors dossier législatif"
        )}
      </p>
      <ul className={classes.liste}>
        {visibles.map((scrutin) => (
          <LigneDeScrutin key={scrutin.id} scrutin={scrutin} />
        ))}
      </ul>
      {restants > 0 ? (
        <Button variant="tertiaire" size="sm" onClick={() => setTout(true)}>
          Voir {restants === 1 ? "l'autre scrutin" : `les ${restants} autres scrutins`}
        </Button>
      ) : null}
    </li>
  );
};

/**
 * Scrutins d'une séance, regroupés par texte (reprise de `ScrutinsByDossier` de apps/web). Le
 * verdict est écrit (badge texte), jamais porté par la seule couleur.
 */
export const ScrutinsDeSeance = ({
  scrutins,
  titre = "Scrutins de la séance",
  titleAs: Titre = "h4",
}: {
  scrutins: ScrutinDeReunion[];
  titre?: string;
  titleAs?: "h3" | "h4" | "h5";
}) => (
  <div className={classes.bloc}>
    <Titre className={classes.entete}>
      {titre} ({scrutins.length})
    </Titre>
    <ul className={classes.groupes}>
      {grouperParDossier(scrutins).map((groupe) => (
        <GroupeDeScrutins key={groupe.cle} groupe={groupe} />
      ))}
    </ul>
  </div>
);
