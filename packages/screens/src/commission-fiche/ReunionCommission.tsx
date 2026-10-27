import type { CommissionReunion } from "@clair/data";
import { Card, Link } from "@clair/ui";
import { MapPin, Users } from "lucide-react";
import {
  heureDe,
  jourLong,
  lienSur,
  pluriel,
  urlDuCompteRendu,
} from "../shared/reunions/reunions.ts";
import { ScrutinsDeSeance } from "../shared/reunions/ScrutinsDeSeance.tsx";
import classes from "./CommissionFicheScreen.module.css";
import { OrdreDuJour } from "./OrdreDuJour.tsx";

/**
 * Une réunion d'une commission : date (lien vers la page de la réunion), heure, ordre du jour,
 * lieu, vidéo et compte rendu (liens externes), participants et, pour l'hémicycle, scrutins.
 * Les liens restent distincts : pas de carte entièrement cliquable qui en contiendrait d'autres.
 */
export const ReunionCommission = ({
  reunion,
  maintenant,
}: {
  reunion: CommissionReunion;
  /** Instant de référence : le compte rendu n'existe qu'une fois la réunion passée. */
  maintenant: Date;
}) => {
  const passee = new Date(reunion.dateDebut) < maintenant;
  const compteRendu = passee ? urlDuCompteRendu(reunion.compteRenduRef) : null;
  const video = lienSur(reunion.urlVideo);
  const jour = jourLong(reunion.dateDebut);
  return (
    <Card
      as="li"
      titleAs="h3"
      title={
        <Link href={`/reunions/${encodeURIComponent(reunion.uid)}`}>
          <span className={classes.capitale}>{jour}</span>
        </Link>
      }
      footer={
        video || compteRendu || reunion.lieu || (reunion.nbParticipants ?? 0) > 0 ? (
          <div className={classes.reunionMeta}>
            {reunion.lieu ? (
              <span className={classes.metaItem}>
                <MapPin className={classes.icone} aria-hidden="true" />
                <span className="clair-visually-hidden">Lieu : </span>
                {reunion.lieu}
              </span>
            ) : null}
            {(reunion.nbParticipants ?? 0) > 0 ? (
              <span className={classes.metaItem}>
                <Users className={classes.icone} aria-hidden="true" />
                {pluriel(reunion.nbParticipants ?? 0, "participant")}
              </span>
            ) : null}
            {video ? (
              <Link href={video} external>
                Vidéo
              </Link>
            ) : null}
            {compteRendu ? (
              <Link href={compteRendu} external>
                Compte rendu
              </Link>
            ) : null}
          </div>
        ) : undefined
      }
    >
      <p className={classes.heure}>
        <time dateTime={reunion.dateDebut}>{heureDe(reunion.dateDebut)}</time>
        {reunion.dateFin ? (
          <>
            {" "}
            à <time dateTime={reunion.dateFin}>{heureDe(reunion.dateFin)}</time>
          </>
        ) : null}
        {reunion.etat === "annule" ? " · Annulée" : null}
      </p>
      <OrdreDuJour resume={reunion.odjResume} complet={reunion.odjComplet} />
      {reunion.scrutins && reunion.scrutins.length > 0 ? (
        <ScrutinsDeSeance scrutins={reunion.scrutins} />
      ) : null}
    </Card>
  );
};
