import type { ParlementaireDetail } from "@clair/data";
import { Card, ProvenanceLabel, SectionHeader } from "@clair/ui";
import { formatDate } from "../shared/parlementaires/chambre.ts";
import classes from "./ParlementaireFicheScreen.module.css";

type FicheResumeIAProps = Pick<
  ParlementaireDetail,
  "resumeIA" | "parcoursIA" | "positionsClesIA" | "faitsNotablesIA" | "iaGeneratedAt"
>;

/**
 * Synthèse générée par IA (Mistral) à partir des données publiques : toujours signalée comme
 * telle, « à vérifier », avec sa date et un lien vers la méthode. Rien n'est affiché sans résumé.
 */
export const FicheResumeIA = ({
  resumeIA,
  parcoursIA,
  positionsClesIA,
  faitsNotablesIA,
  iaGeneratedAt,
}: FicheResumeIAProps) => {
  if (!resumeIA) return null;
  const blocs = [
    { titre: "En bref", texte: resumeIA },
    { titre: "Parcours", texte: parcoursIA },
    { titre: "Positions clés", texte: positionsClesIA },
    { titre: "Faits notables", texte: faitsNotablesIA },
  ].filter((bloc) => bloc.texte);

  return (
    <section className={classes.section} aria-labelledby="resume-ia">
      <SectionHeader
        id="resume-ia"
        title="Synthèse"
        description={
          <span className={classes.provenance}>
            <ProvenanceLabel provenance="ia" methodologyHref="/methodologie#enrichissement-ia" />
            {iaGeneratedAt ? <span>Mise à jour le {formatDate(iaGeneratedAt)}</span> : null}
          </span>
        }
      />
      <ul className={classes.grilleDeux}>
        {blocs.map((bloc) => (
          <Card key={bloc.titre} as="li" title={bloc.titre}>
            <p className={classes.texte}>{bloc.texte}</p>
          </Card>
        ))}
      </ul>
    </section>
  );
};
