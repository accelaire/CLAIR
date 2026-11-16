"use client";

import type { EtapeParcoursDossier } from "@clair/data";
import { ChambreBadge, EmptyState, Link } from "@clair/ui";
import { Landmark, Users } from "lucide-react";
import { useId } from "react";
import { VotesDeLEtape } from "../shared/parcours/VotesDeLEtape.tsx";
import classes from "./DossierFicheScreen.module.css";

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

const libelleEtape = (etape: EtapeParcoursDossier) =>
  etape.commission?.nom ??
  (etape.type === "commission" ? "Réunion de commission" : "Séance publique");

/** « 12 prises de parole · 3 avis sur amendements » ; les votes ont leur bouton. */
export const volumeEtape = (etape: EtapeParcoursDossier) =>
  [
    etape.nbPrises ? `${etape.nbPrises} prise${etape.nbPrises > 1 ? "s" : ""} de parole` : null,
    etape.nbAvis ? `${etape.nbAvis} avis sur amendements` : null,
  ]
    .filter(Boolean)
    .join(" · ") || null;

/**
 * Une étape en ligne dense, comme `ParcoursParlementaire.tsx` de apps/web : sa date, sa chambre
 * et son volume, puis son nom (lien vers le débat complet quand la page existe), et ses votes
 * repliés derrière un bouton « N votes » (un texte budgétaire en compte des centaines).
 */
const Etape = ({ etape }: { etape: EtapeParcoursDossier }) => {
  const date = dateFormat.format(new Date(etape.date));
  const volume = volumeEtape(etape);
  const Icone = etape.type === "commission" ? Users : Landmark;
  return (
    <li className={classes.etape}>
      <div className={classes.etapeCorps}>
        <p className={classes.etapeMeta}>
          <Icone className={classes.etapeIcone} aria-hidden="true" />
          <time dateTime={etape.date}>{date}</time>
          {etape.chambre ? <ChambreBadge chambre={etape.chambre} short size="sm" /> : null}
          {volume ? <span>{volume}</span> : null}
        </p>
        <p className={classes.etapeTitre}>
          {etape.consultable ? (
            <Link href={`/reunions/${encodeURIComponent(etape.uid)}`}>{libelleEtape(etape)}</Link>
          ) : (
            libelleEtape(etape)
          )}
        </p>
      </div>
      <VotesDeLEtape scrutins={etape.scrutins} date={date} />
    </li>
  );
};

/**
 * Parcours du texte : les réunions de commission et les séances publiques où il a été examiné,
 * dans l'ordre, une ligne dense par étape (apps/web). La frise verticale qui les répétait
 * au-dessus de cette liste doublait la hauteur de la page.
 */
export const ParcoursDossier = ({ etapes }: { etapes: EtapeParcoursDossier[] }) => {
  const titreId = useId();
  if (etapes.length === 0) {
    return (
      <EmptyState
        title="Aucune étape connue"
        description="Aucune réunion ni séance n'est rattachée à ce texte pour l'instant."
      />
    );
  }
  return (
    <section className={classes.parcours} aria-labelledby={titreId}>
      <h3 id={titreId} className={classes.parcoursTitre}>
        Parcours du texte
      </h3>
      <p className={classes.mention}>
        Les réunions de commission et les séances publiques où ce texte a été examiné, dans l'ordre.
        Chaque étape mène à son débat complet.
      </p>
      <ol className={classes.etapes} aria-labelledby={titreId}>
        {etapes.map((etape) => (
          <Etape key={etape.uid} etape={etape} />
        ))}
      </ol>
    </section>
  );
};
