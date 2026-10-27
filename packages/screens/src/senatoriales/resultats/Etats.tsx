import type { EtapeSecondTour, ResultatsNationaux, StatutCirconscription } from "@clair/data";
import { CheckCircle2, CircleDashed, Clock, Contrast, Hourglass } from "lucide-react";
import type { ReactNode } from "react";
import { couleurFamille, libelleFamille } from "../lib/familles.ts";
import { libelleStatut } from "../lib/resultats.ts";
import classes from "./Resultats.module.css";

const Badge = ({ icone, children }: { icone: ReactNode; children: ReactNode }) => (
  <span className={classes.badgeEtat}>
    {icone}
    {children}
  </span>
);

/** État de la soirée à l'échelle nationale. */
export const BadgeEtat = ({
  compteurs,
  maintenant,
}: {
  compteurs: ResultatsNationaux["compteurs"];
  maintenant: string;
}) => {
  if (compteurs.pourvue === compteurs.circonscriptions) {
    return <Badge icone={<CheckCircle2 aria-hidden="true" />}>Résultats connus</Badge>;
  }
  if (compteurs.pourvue + compteurs.partielle + compteurs.second_tour > 0) {
    return <Badge icone={<Contrast aria-hidden="true" />}>Résultats partiels</Badge>;
  }
  // Wallis-et-Futuna ouvre ses bureaux le samedi à 22h30, heure de Paris.
  if (new Date(maintenant) < new Date("2026-09-26T22:30:00+02:00")) {
    return <Badge icone={<CircleDashed aria-hidden="true" />}>Scrutin dimanche 27 septembre</Badge>;
  }
  return <Badge icone={<Clock aria-hidden="true" />}>Vote en cours</Badge>;
};

/** État d'une circonscription, en badge d'en-tête. */
export const BadgeCirconscription = ({ statut }: { statut: StatutCirconscription }) => {
  switch (statut) {
    case "pourvue":
      return <Badge icone={<CheckCircle2 aria-hidden="true" />}>Résultats connus</Badge>;
    case "partielle":
    case "second_tour":
      return <Badge icone={<Contrast aria-hidden="true" />}>1er tour connu</Badge>;
    case "resultats_attendus":
      return <Badge icone={<Hourglass aria-hidden="true" />}>Résultats attendus</Badge>;
    case "vote_en_cours":
      return <Badge icone={<Clock aria-hidden="true" />}>Vote en cours</Badge>;
    default:
      return (
        <Badge icone={<CircleDashed aria-hidden="true" />}>Scrutin dimanche 27 septembre</Badge>
      );
  }
};

/** Pictogramme et libellé de l'état d'une circonscription. */
export const PastilleEtat = ({
  statut,
  secondTour,
  connue,
}: {
  statut: StatutCirconscription;
  secondTour: EtapeSecondTour | null;
  /** Circonscription pourvue : libellé en couleur de texte, sinon en mention. */
  connue: boolean;
}) => {
  const picto: Record<StatutCirconscription, ReactNode> = {
    pas_ouvert: <CircleDashed aria-hidden="true" />,
    vote_en_cours: <Clock aria-hidden="true" />,
    resultats_attendus: <Hourglass aria-hidden="true" />,
    second_tour: (
      <span className={classes.pictoDeux} aria-hidden="true">
        2
      </span>
    ),
    partielle: <Contrast aria-hidden="true" />,
    pourvue: <CheckCircle2 aria-hidden="true" />,
  };
  return (
    <span className={classes.pastilleEtat} data-connue={connue || undefined}>
      {picto[statut]}
      {libelleStatut(statut, secondTour)}
    </span>
  );
};

/**
 * Un point par siège : plein et coloré par la famille de l'élu, vide tant que le siège n'est pas
 * attribué. Le décompte est aussi donné en texte, pour qui ne voit pas les couleurs.
 */
export const PointsSieges = ({
  sieges,
}: {
  sieges: ({ famille: string | null; nuance: string | null } | null)[];
}) => {
  const attribues = sieges.filter((s) => s !== null);
  const resume = `${attribues.length} siège${attribues.length > 1 ? "s" : ""} attribué${attribues.length > 1 ? "s" : ""} sur ${sieges.length}${
    attribues.length > 0
      ? ` : ${attribues.map((s) => `${libelleFamille(s.famille)}${s.nuance ? ` (${s.nuance})` : ""}`).join(", ")}`
      : ""
  }`;
  return (
    <span className={classes.points}>
      {sieges.map((siege, i) =>
        siege ? (
          <span
            key={i}
            className={classes.point}
            style={{ backgroundColor: couleurFamille(siege.famille) }}
            title={`${libelleFamille(siege.famille)}${siege.nuance ? ` (${siege.nuance})` : ""}`}
            aria-hidden="true"
          />
        ) : (
          <span
            key={i}
            className={classes.point}
            data-vide
            title="Siège non attribué"
            aria-hidden="true"
          />
        ),
      )}
      <span className="clair-visually-hidden">{resume}</span>
    </span>
  );
};
