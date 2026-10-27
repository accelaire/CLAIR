import type { AgendaEvenement, AgendaReunion } from "@clair/data";
import { EmptyState, EvenementCard, Link } from "@clair/ui";
import {
  lienSur,
  pluriel,
  pointsDeLOrdreDuJour,
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

/** Titre d'une réunion : l'organe réuni, sinon la nature de la réunion. */
const titreDeReunion = (reunion: AgendaReunion) =>
  reunion.commission?.nom ||
  reunion.commission?.nomCourt ||
  (reunion.type === "seance" ? "Séance publique" : "Réunion de commission");

const Reunion = ({ reunion, maintenant }: { reunion: AgendaReunion; maintenant: Date }) => {
  const passee = new Date(reunion.dateDebut) < maintenant;
  const compteRendu = passee ? urlDuCompteRendu(reunion.compteRenduRef) : null;
  const video = lienSur(reunion.urlVideo);
  const points = pointsDeLOrdreDuJour(reunion.odjResume, null);
  const liens = [
    video ? { label: "Vidéo", href: video } : null,
    compteRendu ? { label: "Compte rendu", href: compteRendu } : null,
  ].filter((lien): lien is { label: string; href: string } => lien !== null);
  return (
    <li className={classes.reunion}>
      <EvenementCard
        titleAs="h3"
        type={reunion.type === "seance" ? "seance" : "commission"}
        title={titreDeReunion(reunion)}
        href={`/reunions/${encodeURIComponent(reunion.uid)}`}
        chambre={chambreDeReunion(reunion)}
        start={reunion.dateDebut}
        end={reunion.dateFin}
        description={points.length > 0 ? points.join(" · ") : null}
        lieu={reunion.lieu}
      />
      {liens.length > 0 || reunion.nbParticipants > 0 || (reunion.scrutins?.length ?? 0) > 0 ? (
        <div className={classes.complements}>
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
 * distincts.
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
  if (!jour) {
    return (
      <EmptyState
        title="Choisissez un jour dans le calendrier"
        description="Les jours marqués d'un point ont des réunions."
      />
    );
  }
  const triees = [...reunions].sort(
    (a, b) => new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime(),
  );
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
                <Reunion key={reunion.id} reunion={reunion} maintenant={maintenant} />
              ))}
            </ul>
          ) : null}
        </>
      )}
    </section>
  );
};
