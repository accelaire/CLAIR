import type { LobbyingAction, LobbyingActionListItem } from "@clair/data";
import { Badge, Card, type CardHeading, Link, LobbyisteLogo } from "@clair/ui";
import { CalendarDays } from "lucide-react";
import classes from "./ActionLobbying.module.css";
import { cibleLibelle, formatJour, objetEtSecteurs, typeLibelle } from "./format.ts";

export type ActionLobbyingProps = {
  action: LobbyingAction;
  /** Auteur de l'action : affiché en pied de carte, avec un lien vers sa fiche. */
  lobbyiste?: LobbyingActionListItem["lobbyiste"];
  /** Nombre maximal de secteurs affichés (les suivants sont comptés). */
  maxSecteurs?: number;
  titleAs?: CardHeading;
};

/**
 * Action de représentation d'intérêts déclarée à la HATVP : secteurs, responsables visés et
 * date en surtitre, objet en titre, texte visé, parlementaire rencontré et auteur.
 * Remplace les cartes d'action de `app/lobbying/**` de apps/web. Élément de liste (`li`).
 */
export const ActionLobbying = ({
  action,
  lobbyiste,
  maxSecteurs = 3,
  titleAs = "h3",
}: ActionLobbyingProps) => {
  const { objet, secteurs } = objetEtSecteurs(action.description, action.secteursList);
  const visibles = secteurs.slice(0, maxSecteurs);
  const autres = secteurs.length - visibles.length;
  const cible = cibleLibelle(action.cible);
  const parlementaire = action.parlementaire;
  const type = lobbyiste ? typeLibelle(lobbyiste.type) : null;

  return (
    <Card
      as="li"
      titleAs={titleAs}
      title={objet || "Objet non précisé"}
      eyebrow={
        <>
          {visibles.map((secteur) => (
            <Badge key={secteur} size="sm">
              {secteur}
            </Badge>
          ))}
          {autres > 0 ? (
            <Badge size="sm">
              +{autres}
              <span className="clair-visually-hidden">
                {" "}
                autre{autres > 1 ? "s" : ""} secteur{autres > 1 ? "s" : ""}
              </span>
            </Badge>
          ) : null}
          {cible ? (
            <Badge size="sm" tone="info">
              <span className="clair-visually-hidden">Cible : </span>
              {cible}
            </Badge>
          ) : null}
          {action.dateDebut ? (
            <span className={classes.date}>
              <CalendarDays aria-hidden="true" className={classes.icon} />
              <time dateTime={action.dateDebut.slice(0, 10)}>{formatJour(action.dateDebut)}</time>
            </span>
          ) : null}
        </>
      }
      footer={
        lobbyiste ? (
          <div className={classes.auteur}>
            <LobbyisteLogo nom={lobbyiste.nom} size="sm" decorative />
            <div className={classes.auteurTexte}>
              <Link href={`/lobbying/${lobbyiste.id}`} className={classes.auteurNom}>
                {lobbyiste.nom}
              </Link>
              {type || lobbyiste.secteur ? (
                <span className={classes.mention}>
                  {[type, lobbyiste.secteur].filter(Boolean).join(" · ")}
                </span>
              ) : null}
            </div>
          </div>
        ) : undefined
      }
    >
      {action.texteViseNom || action.cibleNom || parlementaire ? (
        <dl className={classes.details}>
          {action.texteViseNom ? (
            <div className={classes.detail}>
              <dt>Texte visé</dt>
              <dd>{action.texteViseNom}</dd>
            </div>
          ) : null}
          {action.cibleNom ? (
            <div className={classes.detail}>
              <dt>Responsables visés</dt>
              <dd>{action.cibleNom}</dd>
            </div>
          ) : null}
          {parlementaire ? (
            <div className={classes.detail}>
              <dt>Parlementaire rencontré</dt>
              <dd className={classes.parlementaire}>
                <Link href={`/deputes/${encodeURIComponent(parlementaire.slug)}`}>
                  {parlementaire.prenom} {parlementaire.nom}
                </Link>
                {parlementaire.groupe ? (
                  <span className={classes.mention}>{parlementaire.groupe.nom}</span>
                ) : null}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </Card>
  );
};
