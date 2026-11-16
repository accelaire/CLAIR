"use client";

import { useApiQuery } from "@clair/api-client";
import type { InterventionSeance, PageSeances, SeanceInterventions } from "@clair/data";
import { Badge, Card, ExpandableText, Link } from "@clair/ui";
import { NativeSelect } from "@mantine/core";
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { formatDate, scrutinHref } from "../shared/parlementaires/chambre.ts";
import { ListeOnglet } from "./ListeOnglet.tsx";
import { type OngletProps, PeriodeFiltre } from "./OngletCommun.tsx";
import classes from "./ParlementaireFicheScreen.module.css";
import { interventionsQueryOf, TYPES_INTERVENTION } from "./params.ts";

const TYPES: Record<string, string> = {
  question: "Question",
  intervention: "Intervention",
  explication_vote: "Explication de vote",
  reponse_gouvernement: "Réponse du Gouvernement",
  interruption: "Interruption",
};

const InterventionItem = ({ intervention }: { intervention: InterventionSeance }) => (
  <li className={classes.intervention}>
    <p className={classes.meta}>
      <Badge size="sm">{TYPES[intervention.type] ?? intervention.type}</Badge>
      {intervention.articleVise ? <span>{intervention.articleVise}</span> : null}
      {intervention.dossier ? (
        <Link href={`/dossiers/${intervention.dossier.uid}`}>{intervention.dossier.titre}</Link>
      ) : null}
    </p>
    <ExpandableText maxLength={280}>
      {intervention.hasMore ? `${intervention.contenu}…` : intervention.contenu}
    </ExpandableText>
    {intervention.sourceUrl ? (
      <Link href={intervention.sourceUrl} external>
        Compte rendu intégral
      </Link>
    ) : null}
  </li>
);

const compte = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/**
 * Une séance : ses prises de parole, ses scrutins, et un lien vers la page de la séance entière
 * (`/reunions/<seanceId>`, comme `interventions-list.tsx` de apps/web), où se lisent les autres
 * orateurs, l'ordre du jour et les votes à leur place.
 *
 * Repliable comme dans apps/web : seule la première séance de la page est ouverte d'office, les
 * autres n'affichent que leur date et leur volume (un député en compte des centaines). Le repli
 * n'est qu'un confort de lecture : il ne change pas l'adresse.
 */
const SeanceItem = ({
  seance,
  ouverteParDefaut,
}: {
  seance: SeanceInterventions;
  ouverteParDefaut: boolean;
}) => {
  const [ouverte, setOuverte] = useState(ouverteParDefaut);
  const id = useId();
  const pageDeLaSeance = `/reunions/${encodeURIComponent(seance.seanceId)}`;
  const date = formatDate(seance.date);
  const volume = [
    compte(seance.interventions.length, "intervention"),
    seance.scrutins.length > 0 ? compte(seance.scrutins.length, "vote") : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Card
      as="article"
      title={<Link href={pageDeLaSeance}>Séance du {date}</Link>}
      footer={
        ouverte ? (
          <Link href={pageDeLaSeance}>
            Voir la séance complète<span className="clair-visually-hidden"> du {date}</span>
          </Link>
        ) : undefined
      }
    >
      <button
        type="button"
        className={classes.basculeSeance}
        aria-expanded={ouverte}
        aria-controls={id}
        onClick={() => setOuverte((valeur) => !valeur)}
      >
        <ChevronDown className={classes.chevron} data-ouvert={ouverte} aria-hidden="true" />
        {ouverte ? "Masquer" : "Afficher"} les prises de parole
        <span className="clair-visually-hidden"> de la séance du {date}</span>
        <span className={`${classes.volume} clair-chiffres`}>{volume}</span>
      </button>
      <div id={id} hidden={!ouverte} className={classes.contenuSeance}>
        <ul className={classes.interventions}>
          {seance.interventions.map((intervention) => (
            <InterventionItem key={intervention.id} intervention={intervention} />
          ))}
        </ul>
        {seance.scrutins.length > 0 ? (
          <div className={classes.scrutinsSeance}>
            <h4 className={classes.sousTitre}>Scrutins de la séance</h4>
            <ul className={classes.liensScrutins}>
              {seance.scrutins.map((scrutin) => (
                <li key={scrutin.id}>
                  <Link href={scrutinHref(scrutin)}>
                    Scrutin n° {scrutin.numero} : {scrutin.titre}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Card>
  );
};

/** Onglet « Interventions » : prises de parole en séance, regroupées par séance. */
export const OngletInterventions = ({
  chemin,
  slug,
  filtres,
  changer,
  pageHref,
  dateMin,
  deuxChambres,
}: OngletProps) => {
  const query = useApiQuery<PageSeances>(
    `${chemin}/${slug}/interventions`,
    interventionsQueryOf(filtres),
  );
  return (
    <ListeOnglet
      query={query}
      nom="séances"
      vide={
        filtres.type
          ? "Aucune prise de parole de cette nature pour ces critères."
          : "Aucune intervention trouvée pour ces critères."
      }
      pageHref={pageHref}
      getKey={(seance) => seance.seanceId}
      renderItem={(seance, rang) => <SeanceItem seance={seance} ouverteParDefaut={rang === 0} />}
      filtres={
        <>
          <PeriodeFiltre
            filtres={filtres}
            changer={changer}
            dateMin={dateMin}
            deuxChambres={deuxChambres}
          />
          <NativeSelect
            label="Nature des prises de parole"
            value={filtres.type}
            onChange={(event) => {
              const valeur = event.currentTarget.value;
              changer({
                type: TYPES_INTERVENTION.find((type) => type.valeur === valeur)?.valeur ?? "",
              });
            }}
            data={[
              { value: "", label: "Toutes les prises de parole" },
              ...TYPES_INTERVENTION.map((type) => ({ value: type.valeur, label: type.libelle })),
            ]}
          />
          {filtres.type === "interruption" ? (
            <p className={classes.note}>
              Les interruptions sont de vraies prises de parole, attribuées à leur auteur par le
              compte rendu. Elles n'entrent dans aucun compteur d'activité : les mêler aux
              interventions de fond ajouterait des milliers de lignes de chahut à l'activité d'un
              parlementaire.
            </p>
          ) : null}
        </>
      }
    />
  );
};
