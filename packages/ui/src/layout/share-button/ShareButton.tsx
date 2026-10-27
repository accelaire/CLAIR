"use client";

import { useTimeout } from "@mantine/hooks";
import { Check, Share2 } from "lucide-react";
import { useState } from "react";
import classes from "./ShareButton.module.css";

export type ShareButtonProps = {
  /** Adresse à partager, absolue ou relative au site ; la page courante par défaut. */
  url?: string;
  /** Titre transmis au partage natif ; le titre du document par défaut. */
  title?: string;
  /** Texte d'accompagnement transmis au partage natif. */
  text?: string;
  /** Icône seule (le libellé reste le nom accessible du bouton). */
  iconOnly?: boolean;
  /** Libellé du bouton. */
  label?: string;
};

type Status = { kind: "idle" } | { kind: "copied" } | { kind: "error"; url: string };

/** Durée d'affichage de la confirmation « Lien copié ». */
const CONFIRMATION_MS = 2000;

const absoluteUrl = (url: string | undefined) => {
  const raw = url ?? window.location.href;
  return raw.startsWith("/") ? `${window.location.origin}${raw}` : raw;
};

/** Partage annulé par la personne : rien d'autre à faire. */
const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

/**
 * Bouton de partage d'une page : partage natif (Web Share API) quand le navigateur le propose,
 * sinon copie du lien dans le presse-papier, confirmée visuellement et annoncée aux lecteurs
 * d'écran (`aria-live`). Si la copie échoue, le lien est affiché pour être copié à la main.
 */
export const ShareButton = ({
  url,
  title,
  text,
  iconOnly = false,
  label = "Partager",
}: ShareButtonProps) => {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const reset = useTimeout(() => setStatus({ kind: "idle" }), CONFIRMATION_MS);

  const share = async () => {
    const shareUrl = absoluteUrl(url);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: title ?? document.title, text, url: shareUrl });
        return;
      } catch (error) {
        if (isAbort(error)) return;
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setStatus({ kind: "copied" });
      reset.clear();
      reset.start();
    } catch {
      setStatus({ kind: "error", url: shareUrl });
    }
  };

  const copied = status.kind === "copied";
  const visibleLabel = copied ? "Lien copié" : label;

  return (
    <span className={classes.wrapper}>
      <button
        type="button"
        className={classes.button}
        data-icon-only={iconOnly || undefined}
        data-copied={copied || undefined}
        aria-label={iconOnly ? visibleLabel : undefined}
        onClick={share}
      >
        {copied ? (
          <Check className={classes.icon} aria-hidden="true" />
        ) : (
          <Share2 className={classes.icon} aria-hidden="true" />
        )}
        {iconOnly ? null : <span>{visibleLabel}</span>}
      </button>
      <span className="clair-visually-hidden" aria-live="polite">
        {copied ? "Lien copié dans le presse-papier." : ""}
      </span>
      {status.kind === "error" ? (
        <span className={classes.error} role="alert">
          Copie impossible. Lien à copier : <span className={classes.url}>{status.url}</span>
        </span>
      ) : null}
    </span>
  );
};
