import classes from "./TableauDonnees.module.css";

export type ColonneDonnees = { cle: string; libelle: string; numerique?: boolean };

/**
 * Alternative textuelle d'un graphique (RGAA) : les mêmes données en tableau, dépliable sans
 * script (`<details>`). Ajouté au portage depuis apps/web, dont les graphiques n'en avaient pas.
 */
export const TableauDonnees = ({
  legende,
  colonnes,
  lignes,
}: {
  legende: string;
  colonnes: ColonneDonnees[];
  lignes: Record<string, string | number>[];
}) => (
  <details className={classes.details}>
    <summary className={classes.resume}>Afficher les données</summary>
    <div className={classes.defilement}>
      <table className={classes.tableau}>
        <caption className={classes.legende}>{legende}</caption>
        <thead>
          <tr>
            {colonnes.map((colonne) => (
              <th key={colonne.cle} scope="col" data-numerique={colonne.numerique || undefined}>
                {colonne.libelle}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne, index) => (
            <tr key={`${index}-${String(ligne[colonnes[0]?.cle ?? ""])}`}>
              {colonnes.map((colonne, rang) => {
                const valeur = ligne[colonne.cle] ?? "—";
                const contenu =
                  typeof valeur === "number" ? valeur.toLocaleString("fr-FR") : valeur;
                return rang === 0 ? (
                  <th key={colonne.cle} scope="row">
                    {contenu}
                  </th>
                ) : (
                  <td
                    key={colonne.cle}
                    data-numerique={colonne.numerique || undefined}
                    className="clair-chiffres"
                  >
                    {contenu}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </details>
);
