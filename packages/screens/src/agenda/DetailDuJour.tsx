import type { AgendaEvenement, AgendaReunion } from "@clair/data";
import { EmptyState, EvenementCard, isHappeningNow, Link } from "@clair/ui";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { lienDuDirect, useDirects, useHeureCourante } from "../shared/reunions/directs.ts";
import {
  lienSur,
  nomAffiche,
  pluriel,
  pointsDeLOrdreDuJour,
  tronquer,
  urlDuCompteRendu,
} from "../shared/reunions/reunions.ts";
import { ScrutinsDeSeance } from "../shared/reunions/ScrutinsDeSeance.tsx";
import classes from "./AgendaScreen.module.css";
import { chambreDeReunion, pageDedieePour } from "./evenements.ts";

const titreDuJour = (jour: string) => {
  const texte = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${jour}T12:00:00Z`));
  return texte.charAt(0).toUpperCase() + texte.slice(1);
};

/** Titre d'une réunion : l'organe réuni (nettoyé à l'affichage), sinon sa nature. */
const titreDeReunion = (reunion: AgendaReunion) => {
  const organe = reunion.commission?.nom || reunion.commission?.nomCourt;
  if (organe) return nomAffiche(organe);
  return reunion.type === "seance" ? "Séance publique" : "Réunion de commission";
};

/**
 * Longueur de l'ordre du jour replié, environ deux lignes de carte : apps/web le coupait à deux
 * lignes, avec un bouton pour le déplier. La coupe au caractère rend la même chose côté serveur.
 */
const ODJ_REPLIE = 180;

const Reunion = ({
  reunion,
  maintenant,
  enCours,
  direct,
}: {
  reunion: AgendaReunion;
  maintenant: Date;
  /** La réunion a lieu maintenant (fenêtre début → fin, ou 4 h). */
  enCours: boolean;
  /** Lien de la retransmission en direct, s'il est connu. */
  direct?: string;
}) => {
  const passee = new Date(reunion.dateDebut) < maintenant;
  const compteRendu = passee ? urlDuCompteRendu(reunion.compteRenduRef) : null;
  // Pendant le direct, « Suivre en direct » suffit : la vidéo mènerait à un enregistrement que la
  // séance n'a pas fini d'écrire (règle de apps/web).
  const video = enCours && direct ? null : lienSur(reunion.urlVideo);
  const points = pointsDeLOrdreDuJour(reunion.odjResume, null);
  const ordreDuJour = points.join(" · ");
  const odjLong = ordreDuJour.length > ODJ_REPLIE;
  const [odjDeplie, setOdjDeplie] = useState(false);
  const liens = [
    video ? { label: "Vidéo", href: video } : null,
    compteRendu ? { label: "Compte rendu", href: compteRendu } : null,
  ].filter((lien): lien is { label: string; href: string } => lien !== null);
  return (
    // `event-<id>` : l'ancre des liens de l'accueil de apps/web (`/agenda?date=…#event-<id>`).
    <li id={`event-${reunion.id}`} className={classes.reunion}>
      <EvenementCard
        titleAs="h3"
        type={reunion.type === "seance" ? "seance" : "commission"}
        title={titreDeReunion(reunion)}
        href={`/reunions/${encodeURIComponent(reunion.uid)}`}
        chambre={chambreDeReunion(reunion)}
        start={reunion.dateDebut}
        end={reunion.dateFin}
        description={
          ordreDuJour ? (odjDeplie ? ordreDuJour : tronquer(ordreDuJour, ODJ_REPLIE)) : null
        }
        lieu={reunion.lieu}
        live={enCours}
        liveHref={enCours ? direct : undefined}
      />
      {odjLong ||
      liens.length > 0 ||
      reunion.nbParticipants > 0 ||
      (reunion.scrutins?.length ?? 0) > 0 ? (
        <div className={classes.complements}>
          {odjLong ? (
            <button
              type="button"
              className={classes.deplier}
              aria-expanded={odjDeplie}
              aria-controls={`event-${reunion.id}`}
              onClick={() => setOdjDeplie((deplie) => !deplie)}
            >
              {odjDeplie ? "Réduire l'ordre du jour" : "Lire tout l'ordre du jour"}
              <span className="clair-visually-hidden"> : {titreDeReunion(reunion)}</span>
              <ChevronDown className={classes.chevron} aria-hidden="true" />
            </button>
          ) : null}
          {liens.length > 0 || reunion.nbParticipants > 0 ? (
            <p className={classes.liensReunion}>
              {reunion.nbParticipants > 0 ? (
                <span>{pluriel(reunion.nbParticipants, "participant")}</span>
              ) : null}
              {liens.map((lien) => (
                <Link key={lien.label} href={lien.href} external>
                  {lien.label}
                  <span className="clair-visually-hidden"> : {titreDeReunion(reunion)}</span>
                </Link>
              ))}
            </p>
          ) : null}
          {reunion.scrutins && reunion.scrutins.length > 0 ? (
            <ScrutinsDeSeance scrutins={reunion.scrutins} titleAs="h4" />
          ) : null}
        </div>
      ) : null}
    </li>
  );
};

const Evenement = ({ evenement }: { evenement: AgendaEvenement }) => {
  const page = pageDedieePour(evenement.slug);
  return (
    <li className={classes.reunion}>
      <EvenementCard
        titleAs="h3"
        type={evenement.type}
        title={evenement.titre}
        chambre={evenement.chambre}
        start={evenement.dateDebut}
        end={evenement.dateFin}
        datePrecise={evenement.datePrecise}
        description={evenement.description}
        sources={(evenement.sources ?? []).map((source) => ({
          label: source.label,
          href: lienSur(source.url) ?? undefined,
        }))}
      />
      {page ? (
        <p className={classes.complements}>
          <Link href={page.href}>{page.label}</Link>
        </p>
      ) : null}
    </li>
  );
};

/**
 * Détail du jour choisi : repères institutionnels d'abord (ils donnent le contexte), puis les
 * réunions par heure. Chaque réunion mène à sa page ; vidéo et compte rendu restent des liens
 * distincts. Une réunion en cours porte « En direct », et le lien de la retransmission quand les
 * chaînes des chambres en diffusent une (relu toutes les cinq minutes).
 */
export const DetailDuJour = ({
  jour,
  reunions,
  evenements,
  maintenant,
}: {
  jour: string;
  reunions: AgendaReunion[];
  evenements: AgendaEvenement[];
  maintenant: Date;
}) => {
  const triees = [...reunions].sort(
    (a, b) => new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime(),
  );
  const heureCourante = useHeureCourante();
  const enCours = new Set(
    heureCourante
      ? triees
          .filter((reunion) => isHappeningNow(reunion.dateDebut, reunion.dateFin, heureCourante))
          .map((reunion) => reunion.id)
      : [],
  );
  const directs = useDirects(Boolean(jour) && enCours.size > 0);
  // Un lien vers une réunion (`#event-<id>`) amène sa carte à l'écran, une fois la liste rendue
  // (comme `DayDetail` de apps/web).
  useEffect(() => {
    if (reunions.length === 0) return;
    const ancre = window.location.hash.slice(1);
    if (!ancre.startsWith("event-")) return;
    const carte = document.getElementById(ancre);
    if (carte && typeof carte.scrollIntoView === "function") {
      const reduit =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      carte.scrollIntoView({ behavior: reduit ? "auto" : "smooth", block: "center" });
    }
  }, [reunions.length]);
  if (!jour) {
    return (
      <EmptyState
        title="Choisissez un jour dans le calendrier"
        description="Les jours marqués d'un point ont des réunions."
      />
    );
  }
  return (
    <section aria-labelledby="jour-choisi" className={classes.detail}>
      <div className={classes.enteteDetail}>
        <h2 id="jour-choisi" className={classes.titreJour}>
          {titreDuJour(jour)}
        </h2>
        {reunions.length > 0 ? (
          <p className={classes.mention}>{pluriel(reunions.length, "réunion")}</p>
        ) : null}
      </div>
      {reunions.length === 0 && evenements.length === 0 ? (
        <EmptyState title="Aucune réunion ce jour" />
      ) : (
        <>
          {evenements.length > 0 ? (
            <ul className={classes.liste} aria-label="Événements institutionnels du jour">
              {evenements.map((evenement) => (
                <Evenement key={evenement.id} evenement={evenement} />
              ))}
            </ul>
          ) : null}
          {triees.length > 0 ? (
            <ul className={classes.liste} aria-label="Réunions du jour">
              {triees.map((reunion) => (
                <Reunion
                  key={reunion.id}
                  reunion={reunion}
                  maintenant={maintenant}
                  enCours={enCours.has(reunion.id)}
                  direct={
                    enCours.has(reunion.id)
                      ? lienDuDirect(reunion, chambreDeReunion(reunion), directs)
                      : undefined
                  }
                />
              ))}
            </ul>
          ) : null}
        </>
      )}
    </section>
  );
};
