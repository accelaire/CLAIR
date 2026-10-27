import type { LobbyisteListItem } from "@clair/data";
import { Badge, Card, LobbyisteLogo } from "@clair/ui";
import { formatBudget, secteursLibelle, typeLibelle } from "./format.ts";
import classes from "./LobbyingListeScreen.module.css";

/**
 * Représentant d'intérêts dans la liste : nom (lien vers la fiche), type, secteurs et chiffres
 * déclarés (budget, actions, personnes). Élément de liste (`li`).
 */
export const LobbyisteItem = ({ lobbyiste }: { lobbyiste: LobbyisteListItem }) => {
  const type = typeLibelle(lobbyiste.type);
  const secteurs = secteursLibelle(lobbyiste.secteursList, lobbyiste.secteur);
  const budget = formatBudget(lobbyiste.budgetAnnuel);
  return (
    <Card
      as="li"
      titleAs="h3"
      href={`/lobbying/${lobbyiste.id}`}
      title={lobbyiste.nom}
      eyebrow={
        <>
          <LobbyisteLogo nom={lobbyiste.nom} size="sm" decorative />
          {type ? <Badge size="sm">{type}</Badge> : null}
        </>
      }
    >
      {secteurs ? <p className={classes.secteurs}>{secteurs}</p> : null}
      <dl className={classes.chiffres}>
        <div>
          <dt>Budget déclaré</dt>
          <dd className="clair-chiffres">{budget ?? "Non déclaré"}</dd>
        </div>
        <div>
          <dt>Actions</dt>
          <dd className="clair-chiffres">{lobbyiste.actionsCount.toLocaleString("fr-FR")}</dd>
        </div>
        {lobbyiste.nbLobbyistes ? (
          <div>
            <dt>Personnes déclarées</dt>
            <dd className="clair-chiffres">{lobbyiste.nbLobbyistes.toLocaleString("fr-FR")}</dd>
          </div>
        ) : null}
      </dl>
    </Card>
  );
};
