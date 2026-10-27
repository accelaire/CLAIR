"use client";

import type { LobbyingAction } from "@clair/data";
import { Button, EmptyState } from "@clair/ui";
import type { ReactNode } from "react";
import { ActionLobbying } from "../lobbying-liste/ActionLobbying.tsx";
import classes from "./LobbyisteFicheScreen.module.css";
import { dansLaPeriode, type LobbyisteFicheParams } from "./params.ts";

type ActionsLobbyisteProps = {
  titreId: string;
  actions: LobbyingAction[];
  periode: LobbyisteFicheParams;
  /** Filtre de période (champ de dates). */
  filtre: ReactNode;
  onReset: () => void;
};

/** Actions déclarées par le représentant, filtrées par période. */
export const ActionsLobbyiste = ({
  titreId,
  actions,
  periode,
  filtre,
  onReset,
}: ActionsLobbyisteProps) => {
  const visibles = actions.filter((action) => dansLaPeriode(action.dateDebut, periode));
  const filtrees = visibles.length !== actions.length;
  const periodeActive = Boolean(periode.dateFrom || periode.dateTo);
  return (
    <>
      <h2 id={titreId} className={classes.titreSection}>
        Actions de lobbying{" "}
        <span className={classes.compte}>
          ({visibles.length.toLocaleString("fr-FR")}
          {filtrees ? ` sur ${actions.length.toLocaleString("fr-FR")}` : ""})
        </span>
      </h2>
      <div className={classes.filtre}>{filtre}</div>
      {visibles.length === 0 ? (
        <EmptyState
          title={
            actions.length === 0 ? "Aucune action déclarée" : "Aucune action sur cette période"
          }
          description={
            actions.length === 0
              ? "Ce représentant n'a déclaré aucune action de lobbying."
              : "Élargissez ou retirez la période choisie."
          }
          action={
            periodeActive ? (
              <Button variant="secondaire" onClick={onReset}>
                Retirer la période
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className={classes.actions}>
          {visibles.map((action) => (
            <ActionLobbying key={action.id} action={action} maxSecteurs={4} />
          ))}
        </ul>
      )}
    </>
  );
};
