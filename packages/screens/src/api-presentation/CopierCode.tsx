"use client";

import { Button } from "@clair/ui";
import { useClipboard } from "@mantine/hooks";
import { Check, Copy } from "lucide-react";
import classes from "./ApiPresentationScreen.module.css";

/** Durée d'affichage de la confirmation « Copié ». */
const CONFIRMATION_MS = 2000;

/**
 * Bouton « Copier » d'un bloc de code : copie dans le presse-papier, confirmée visuellement et
 * annoncée aux lecteurs d'écran. Si la copie échoue, le dit (le code reste sélectionnable).
 */
export const CopierCode = ({ code }: { code: string }) => {
  const clipboard = useClipboard({ timeout: CONFIRMATION_MS });
  const annonce = clipboard.copied
    ? "Commande copiée dans le presse-papier"
    : clipboard.error
      ? "La copie a échoué : sélectionnez la commande pour la copier"
      : "";
  return (
    <span className={classes.copier}>
      <Button
        variant="tertiaire"
        size="sm"
        icon={clipboard.copied ? <Check /> : <Copy />}
        onClick={() => clipboard.copy(code)}
      >
        {clipboard.copied ? "Copié" : "Copier"}
        <span className="clair-visually-hidden"> la commande</span>
      </Button>
      <span role="status" className="clair-visually-hidden">
        {annonce}
      </span>
    </span>
  );
};
