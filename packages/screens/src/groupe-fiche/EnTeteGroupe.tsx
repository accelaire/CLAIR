import { CHAMBRES, type GroupeDetail } from "@clair/data";
import { Badge, ChambreBadge, GroupeBadge, PageHeader } from "@clair/ui";
import {
  formatNombre,
  libellePosition,
  libelleSession,
  nomDuGroupe,
} from "../groupes-liste/format.ts";
import { libelleLegislature } from "../shared/parlementaires/chambre.ts";
import classes from "./GroupeFicheScreen.module.css";

const ELU = { assemblee: "député", senat: "sénateur" } as const;

/**
 * En-tête de la fiche d'un groupe : fil d'Ariane, sigle et nom complet, chambre, période
 * (législature ou session, signalée quand c'est une composition d'époque), position déclarée et
 * effectif (lien vers la liste des membres).
 */
export const EnTeteGroupe = ({ groupe }: { groupe: GroupeDetail }) => {
  const nom = nomDuGroupe(groupe);
  const actifs = groupe.membresActifsCount;
  const position = libellePosition(groupe.position);
  return (
    <PageHeader
      breadcrumb={[
        { label: "Accueil", href: "/" },
        { label: "Groupes politiques", href: "/groupes" },
        { label: CHAMBRES[groupe.chambre].nom, href: `/groupes?chambre=${groupe.chambre}` },
        { label: nom },
      ]}
      title={
        <span className={classes.titre}>
          {groupe.logoUrl ? <img src={groupe.logoUrl} alt="" className={classes.logo} /> : null}
          {groupe.nom}
        </span>
      }
      badges={
        <>
          <GroupeBadge sigle={groupe.nom} nom={nom} couleur={groupe.couleur} />
          <ChambreBadge chambre={groupe.chambre} />
          {groupe.legislature !== null ? (
            <Badge>{libelleLegislature(groupe.legislature)}</Badge>
          ) : null}
          {groupe.session !== null ? (
            <Badge tone={groupe.sessionCourante ? "neutre" : "avertissement"}>
              {libelleSession(groupe.session)}
              {groupe.sessionCourante ? "" : " · composition d'époque"}
            </Badge>
          ) : null}
          {position ? <Badge>Position déclarée : {position}</Badge> : null}
        </>
      }
      description={
        <>
          {groupe.nomComplet && groupe.nomComplet !== groupe.nom ? (
            <p className={classes.lead}>{groupe.nomComplet}</p>
          ) : null}
          <p className={classes.lead}>
            <a href="#membres">
              <span className="clair-chiffres">{formatNombre(actifs)}</span> {ELU[groupe.chambre]}
              {actifs > 1 ? "s" : ""} actif{actifs > 1 ? "s" : ""}
            </a>
          </p>
        </>
      }
    />
  );
};
