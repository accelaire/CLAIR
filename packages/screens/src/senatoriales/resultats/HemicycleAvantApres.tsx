import { nombre } from "../lib/format.ts";
import {
  CATEGORIES_HEMICYCLE,
  FAMILLES_ARC,
  HORS_ARC,
  positionsHemicycle,
} from "../lib/resultats.ts";
import classes from "./Resultats.module.css";

type Repartition = Record<string, number>;

/* Géométrie, en unités du `viewBox` (comme apps/web). */
const VIEWBOX = { largeur: 500, hauteur: 270 };
const CENTRE = { x: 250, y: 255 };
const RAYONS = { interieur: 78, exterieur: 238 };

const repeter = (categorie: string, n: number): string[] =>
  Array.from({ length: n }, () => categorie);

/**
 * Un arc de l'hémicycle : à gauche, de la gauche vers la droite ; les sièges non attribués au
 * milieu, en pointillé, là où ils vont se placer.
 */
const Arc = ({ repartition, etiquette }: { repartition: Repartition; etiquette: string }) => {
  const sieges: string[] = [
    ...(["gauche", "centre"] as const).flatMap((f) => repeter(f, repartition[f] ?? 0)),
    ...repeter("non_attribue", repartition.non_attribue ?? 0),
    ...(["droite", "droite_ou_extreme_droite", "extreme_droite"] as const).flatMap((f) =>
      repeter(f, repartition[f] ?? 0),
    ),
  ];
  const positions = positionsHemicycle(
    sieges.length,
    CENTRE.x,
    CENTRE.y,
    RAYONS.interieur,
    RAYONS.exterieur,
  );
  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.largeur} ${VIEWBOX.hauteur}`}
      className={classes.arc}
      role="img"
      aria-label={etiquette}
    >
      {positions.map((p, i) => {
        const categorie = sieges[i] ?? "non_attribue";
        const vide = categorie === "non_attribue";
        return (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={4.6}
            className={vide ? classes.siegeVide : undefined}
            style={vide ? undefined : { fill: CATEGORIES_HEMICYCLE[categorie]?.couleur }}
            strokeDasharray={vide ? "1.5 1.5" : undefined}
            strokeWidth={vide ? 1 : 0}
          />
        );
      })}
    </svg>
  );
};

const HorsArc = ({ repartition }: { repartition: Repartition }) => {
  const presents = HORS_ARC.filter((c) => c !== "non_attribue" && (repartition[c] ?? 0) > 0);
  if (presents.length === 0) return <p className={classes.petit}>Aucun siège hors de l'axe.</p>;
  return (
    <ul className={classes.horsArc}>
      {presents.map((c) => (
        <li key={c}>
          <span className={classes.horsArcPoints} aria-hidden="true">
            {Array.from({ length: Math.min(repartition[c] ?? 0, 12) }).map((_, i) => (
              <span
                key={i}
                className={classes.pointPetit}
                style={{ backgroundColor: CATEGORIES_HEMICYCLE[c]?.couleur }}
              />
            ))}
          </span>
          {repartition[c]} {CATEGORIES_HEMICYCLE[c]?.libelle.toLowerCase()}
        </li>
      ))}
    </ul>
  );
};

/**
 * Le Sénat avant et après le scrutin, par famille de la nuance attribuée par le ministère au
 * titulaire de chaque siège (pas la composition par groupe, qui n'existe qu'au 5 octobre). Le
 * tableau qui suit donne les mêmes chiffres en texte.
 */
export const HemicycleAvantApres = ({
  avant,
  apres,
  notes,
  complet,
}: {
  avant: Repartition;
  apres: Repartition;
  notes: string[];
  /** Tous les sièges sont attribués : les écarts deviennent lisibles. */
  complet: boolean;
}) => {
  const nonAttribues = apres.non_attribue ?? 0;
  const commence = nonAttribues < 178;
  const legende = [...FAMILLES_ARC, ...HORS_ARC.filter((c) => c !== "non_attribue")].filter(
    (c) => (avant[c] ?? 0) > 0 || (apres[c] ?? 0) > 0,
  );

  return (
    <section className={classes.bloc} aria-labelledby="senat-avant-apres">
      <div className={classes.blocEntete}>
        <h2 id="senat-avant-apres" className={classes.titreBloc}>
          Le Sénat avant et après le scrutin
        </h2>
        <p className={classes.texteMention}>
          348 sièges, par famille politique de la nuance attribuée par le ministère
        </p>
      </div>

      <div className={classes.deuxColonnes} data-rupture="md">
        <figure className={classes.figure}>
          <figcaption className={classes.figcaption}>Avant le 27 septembre</figcaption>
          <Arc
            repartition={avant}
            etiquette="Hémicycle du Sénat avant le scrutin, par famille politique"
          />
          <HorsArc repartition={avant} />
        </figure>
        <figure className={classes.figure}>
          <figcaption className={classes.figcaption}>
            {complet
              ? "Après le 27 septembre"
              : commence
                ? "À ce stade de la soirée"
                : "Après le 27 septembre"}
            {!complet ? (
              <span className={classes.figcaptionNote}>
                {commence
                  ? `${nombre(nonAttribues)} ${nonAttribues > 1 ? "sièges pas encore attribués" : "siège pas encore attribué"}`
                  : "les 178 sièges remis en jeu, en pointillés"}
              </span>
            ) : null}
          </figcaption>
          <Arc
            repartition={apres}
            etiquette="Hémicycle du Sénat après le scrutin, par famille politique"
          />
          <HorsArc repartition={apres} />
        </figure>
      </div>

      <table className={classes.tableau}>
        <caption className="clair-visually-hidden">
          Sièges par famille politique, avant et après le scrutin
        </caption>
        <thead>
          <tr>
            <th scope="col">Famille</th>
            <th scope="col" data-numerique>
              Avant
            </th>
            <th scope="col" data-numerique>
              {complet ? "Après" : "À ce stade"}
            </th>
            {complet ? (
              <th scope="col" data-numerique>
                Écart
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {legende.map((c) => {
            const av = avant[c] ?? 0;
            const ap = apres[c] ?? 0;
            const ecart = ap - av;
            return (
              <tr key={c}>
                <th scope="row">
                  <span className={classes.familleLigne}>
                    <span
                      className={classes.point}
                      style={{ backgroundColor: CATEGORIES_HEMICYCLE[c]?.couleur }}
                      aria-hidden="true"
                    />
                    {CATEGORIES_HEMICYCLE[c]?.libelle}
                  </span>
                </th>
                <td data-numerique className="clair-chiffres">
                  {av}
                </td>
                <td data-numerique className="clair-chiffres">
                  {ap}
                </td>
                {complet ? (
                  <td data-numerique className={`clair-chiffres ${classes.mention}`}>
                    {ecart === 0 ? "=" : ecart > 0 ? `+${ecart}` : `−${-ecart}`}
                  </td>
                ) : null}
              </tr>
            );
          })}
          {!complet ? (
            <tr className={classes.mention}>
              <th scope="row">
                <span className={classes.familleLigne}>
                  <span className={classes.point} data-vide aria-hidden="true" />
                  Siège non attribué
                </span>
              </th>
              <td data-numerique className="clair-chiffres">
                0
              </td>
              <td data-numerique className="clair-chiffres">
                {nonAttribues}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <ul className={classes.notes}>
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
        <li>
          Les régionalistes, les divers et les nuances non publiées n'ont pas de place sur un axe
          gauche-droite : ils sont comptés sous l'hémicycle plutôt que placés dans l'arc.
        </li>
      </ul>
    </section>
  );
};
