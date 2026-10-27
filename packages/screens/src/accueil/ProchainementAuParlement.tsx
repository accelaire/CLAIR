"use client";

import type { AgendaEvenement, HomepageReunion, HomepageUpcoming } from "@clair/data";
import {
  Badge,
  ChambreBadge,
  EmptyState,
  ErrorState,
  EVENEMENT_TYPES,
  LoadingState,
  useNavigation,
} from "@clair/ui";
import { useEffect, useState } from "react";
import { libelleDateEvenement } from "../agenda/evenements.ts";
import classes from "./AccueilScreen.module.css";
import {
  chambreDeReunion,
  heureDe,
  type JourDuPlanning,
  joursDuPlanning,
  reunionEnCours,
  reunionsVisibles,
} from "./agenda.ts";

/**
 * Heure courante, lue après l'hydratation puis chaque minute : le rendu serveur (mis en cache)
 * ne peut pas savoir quelle réunion est en cours au moment de la visite.
 */
const useMaintenant = () => {
  const [maintenant, setMaintenant] = useState<Date | null>(null);
  useEffect(() => {
    setMaintenant(new Date());
    const minuteur = setInterval(() => setMaintenant(new Date()), 60_000);
    return () => clearInterval(minuteur);
  }, []);
  return maintenant;
};

const Repere = ({ evenement, href }: { evenement: AgendaEvenement; href: string }) => {
  const { Link: RouterLink } = useNavigation();
  const { label, icon: Icon } = EVENEMENT_TYPES[evenement.type];
  return (
    <RouterLink href={href} className={classes.repere}>
      <Icon className={classes.icone} aria-hidden="true" />
      <span className={classes.repereTexte}>
        <span className="clair-visually-hidden">{label} : </span>
        <span className={classes.repereTitre}>{evenement.titre}</span>
        <span className={classes.repereDate}>{libelleDateEvenement(evenement)}</span>
      </span>
    </RouterLink>
  );
};

const Reunion = ({ reunion, enCours }: { reunion: HomepageReunion; enCours: boolean }) => {
  const { Link: RouterLink } = useNavigation();
  const chambre = chambreDeReunion(reunion);
  const seance = reunion.type === "seance";
  const organe = reunion.commission?.nomCourt || reunion.commission?.nom;
  return (
    <li>
      <RouterLink
        href={`/reunions/${encodeURIComponent(reunion.uid)}`}
        className={classes.reunion}
        data-en-cours={enCours || undefined}
      >
        <time className={classes.heure} dateTime={reunion.dateDebut}>
          {heureDe(reunion.dateDebut)}
        </time>
        <span className={classes.reunionCorps}>
          <span className={classes.badges}>
            {chambre ? <ChambreBadge chambre={chambre} short size="sm" /> : null}
            <Badge tone="neutre" size="sm">
              {seance ? "Séance" : "Commission"}
            </Badge>
            {enCours ? (
              <Badge tone="info" size="sm">
                En cours
              </Badge>
            ) : null}
          </span>
          <span className={classes.organe}>{organe || "Séance publique"}</span>
          {reunion.odjResume ? <span className={classes.odj}>{reunion.odjResume}</span> : null}
        </span>
      </RouterLink>
    </li>
  );
};

const Jour = ({ jour, maintenant }: { jour: JourDuPlanning; maintenant: Date | null }) => {
  const { Link: RouterLink } = useNavigation();
  const { visibles, restantes } = reunionsVisibles(jour.reunions, maintenant);
  const agendaDuJour = `/agenda?date=${jour.jour}`;
  return (
    <li className={classes.jour}>
      <h3 className={classes.jourTitre}>{jour.titre}</h3>
      {jour.evenements.length > 0 ? (
        <ul className={classes.liste}>
          {jour.evenements.map((evenement) => (
            <li key={evenement.id}>
              <Repere evenement={evenement} href={agendaDuJour} />
            </li>
          ))}
        </ul>
      ) : null}
      <ul className={classes.liste}>
        {visibles.map((reunion) => (
          <Reunion
            key={reunion.id}
            reunion={reunion}
            enCours={reunionEnCours(reunion, maintenant)}
          />
        ))}
      </ul>
      {restantes > 0 ? (
        <RouterLink href={agendaDuJour} className={classes.plus}>
          Afficher plus ({restantes})
          <span className="clair-visually-hidden"> : réunions du {jour.titre}</span>
        </RouterLink>
      ) : null}
    </li>
  );
};

/** Grandes échéances, même au-delà des jours affichés (les sénatoriales, à six semaines…). */
const Echeances = ({ echeances }: { echeances: AgendaEvenement[] }) =>
  echeances.length === 0 ? null : (
    <div className={classes.echeances}>
      <h3 className={classes.echeancesTitre}>Prochaines échéances</h3>
      <ul className={classes.echeancesListe}>
        {echeances.map((evenement) => (
          <li key={evenement.id}>
            <Repere
              evenement={evenement}
              href={`/agenda?date=${evenement.dateDebut.slice(0, 10)}`}
            />
          </li>
        ))}
      </ul>
    </div>
  );

export type ProchainementAuParlementProps = {
  upcoming: HomepageUpcoming | null | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
};

/**
 * Planning des prochains jours de séance et de réunion : un jour par carte (défilement
 * horizontal, au clavier aussi), repères institutionnels en tête de chaque jour, puis les
 * prochaines grandes échéances. Une réunion en cours est signalée en texte.
 */
export const ProchainementAuParlement = ({
  upcoming,
  isPending,
  isError,
  onRetry,
}: ProchainementAuParlementProps) => {
  const maintenant = useMaintenant();

  if (isPending) return <LoadingState label="Chargement de l'agenda…" variant="skeleton" />;
  if (isError) {
    return (
      <ErrorState
        message="L'agenda n'a pas pu être chargé. Vérifiez votre connexion puis réessayez."
        onRetry={onRetry}
      />
    );
  }

  const echeances = upcoming?.echeances ?? [];
  const jours = joursDuPlanning(upcoming?.events ?? [], upcoming?.evenements ?? []);

  if (jours.length === 0) {
    return (
      <>
        <EmptyState title="Aucun événement à venir" />
        <Echeances echeances={echeances} />
      </>
    );
  }

  return (
    <>
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: zone défilante, atteignable au clavier pour la faire défiler (RGAA 12.13) */}
      <section className={classes.defilement} aria-label="Jours à venir" tabIndex={0}>
        <ol className={classes.jours}>
          {jours.map((jour) => (
            <Jour key={jour.jour} jour={jour} maintenant={maintenant} />
          ))}
        </ol>
      </section>
      <Echeances echeances={echeances} />
    </>
  );
};
