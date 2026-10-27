import { Progress } from "@mantine/core";
import classes from "./ResultatVote.module.css";

export type ResultatVoteProps = {
  /** `nombrePour` du scrutin. */
  pour: number;
  /** `nombreContre` du scrutin. */
  contre: number;
  /** `nombreAbstention` du scrutin. */
  abstention: number;
  /** Intitulé lu avant les valeurs (« Résultat du scrutin n° 1234 »). */
  label?: string;
  size?: "sm" | "md";
};

type Position = "pour" | "contre" | "abstention";

const LIBELLES: Record<Position, string> = {
  pour: "Pour",
  contre: "Contre",
  abstention: "Abstention",
};

const nombre = new Intl.NumberFormat("fr-FR");
const pourcentage = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  maximumFractionDigits: 1,
});

/**
 * Répartition des voix pour, contre et abstention : une barre empilée doublée de la légende
 * chiffrée (valeurs et pourcentages en texte). La barre est décorative : la légende porte
 * l'information. Les pourcentages sont calculés par CLAIR sur les votants (pour, contre et
 * abstention), et non sur les seuls suffrages exprimés : la mention le dit à l'écran.
 */
export const ResultatVote = ({
  pour,
  contre,
  abstention,
  label = "Répartition des voix",
  size = "md",
}: ResultatVoteProps) => {
  const valeurs: Record<Position, number> = { pour, contre, abstention };
  const total = pour + contre + abstention;
  const positions: Position[] = ["pour", "contre", "abstention"];

  return (
    <figure className={classes.root} data-size={size}>
      <figcaption className={classes.caption}>{label}</figcaption>
      <Progress.Root
        aria-hidden="true"
        className={classes.bar}
        size={size === "sm" ? "sm" : "lg"}
        radius="xl"
      >
        {total > 0
          ? positions.map((position) => (
              <Progress.Section
                key={position}
                value={(valeurs[position] / total) * 100}
                color={`var(--clair-graphique-vote-${position})`}
                withAria={false}
              />
            ))
          : null}
      </Progress.Root>
      {total > 0 ? (
        <>
          <ul className={classes.legend}>
            {positions.map((position) => (
              <li key={position} className={classes.item} data-position={position}>
                <span className={classes.swatch} aria-hidden="true" />
                <span className={classes.name}>{LIBELLES[position]}</span>
                <span className="clair-chiffres">
                  {nombre.format(valeurs[position])} (
                  {pourcentage.format(valeurs[position] / total)})
                </span>
              </li>
            ))}
          </ul>
          <p className={classes.note}>
            Pourcentages calculés par CLAIR sur les votants (pour, contre et abstention).
          </p>
        </>
      ) : (
        <p className={classes.empty}>Aucune voix exprimée.</p>
      )}
    </figure>
  );
};
