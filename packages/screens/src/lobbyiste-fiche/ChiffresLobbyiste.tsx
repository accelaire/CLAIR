import type { LobbyisteDetail } from "@clair/data";
import { StatCard } from "@clair/ui";
import { formatBudget } from "../lobbying-liste/format.ts";
import classes from "./LobbyisteFicheScreen.module.css";

/** Nombre d'actions renvoyées au plus par `/lobbying/:id`. */
export const ACTIONS_MAX = 50;

/** Chiffres déclarés d'un représentant d'intérêts : budget, personnes, actions. */
export const ChiffresLobbyiste = ({ lobbyiste }: { lobbyiste: LobbyisteDetail }) => {
  const nbActions = lobbyiste.actions.length;
  return (
    <section aria-labelledby="lobbyiste-chiffres" className={classes.section}>
      <h2 id="lobbyiste-chiffres" className="clair-visually-hidden">
        Chiffres déclarés
      </h2>
      <ul className={classes.stats}>
        <StatCard
          as="li"
          label="Budget annuel déclaré"
          value={formatBudget(lobbyiste.budgetAnnuel) ?? "Non déclaré"}
          help="Montant déclaré par tranches : un ordre de grandeur."
        />
        <StatCard
          as="li"
          label="Personnes déclarées"
          value={
            lobbyiste.nbLobbyistes ? lobbyiste.nbLobbyistes.toLocaleString("fr-FR") : "Non déclaré"
          }
          help="Personnes chargées de la représentation d'intérêts."
        />
        <StatCard
          as="li"
          label="Actions déclarées"
          value={nbActions.toLocaleString("fr-FR")}
          detail={nbActions >= ACTIONS_MAX ? `Les ${ACTIONS_MAX} plus récentes` : undefined}
        />
        {lobbyiste.ville ? <StatCard as="li" label="Ville" value={lobbyiste.ville} /> : null}
      </ul>
    </section>
  );
};
