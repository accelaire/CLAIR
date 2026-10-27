"use client";

import { useApiQuery } from "@clair/api-client";
import type { InterventionSeance, PageSeances, SeanceInterventions } from "@clair/data";
import { Badge, Card, ExpandableText, Link } from "@clair/ui";
import { formatDate, scrutinHref } from "../shared/parlementaires/chambre.ts";
import { ListeOnglet } from "./ListeOnglet.tsx";
import { type OngletProps, PeriodeFiltre } from "./OngletCommun.tsx";
import classes from "./ParlementaireFicheScreen.module.css";
import { interventionsQueryOf } from "./params.ts";

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

const SeanceItem = ({ seance }: { seance: SeanceInterventions }) => (
  <Card as="article" title={`Séance du ${formatDate(seance.date)}`}>
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
  </Card>
);

/** Onglet « Interventions » : prises de parole en séance, regroupées par séance. */
export const OngletInterventions = ({
  chemin,
  slug,
  filtres,
  changer,
  pageHref,
  dateMin,
}: OngletProps) => {
  const query = useApiQuery<PageSeances>(
    `${chemin}/${slug}/interventions`,
    interventionsQueryOf(filtres),
  );
  return (
    <ListeOnglet
      query={query}
      nom="séances"
      vide="Aucune intervention trouvée pour ces critères."
      pageHref={pageHref}
      getKey={(seance) => seance.seanceId}
      renderItem={(seance) => <SeanceItem seance={seance} />}
      filtres={<PeriodeFiltre filtres={filtres} changer={changer} dateMin={dateMin} />}
    />
  );
};
