import type { DossierDuScrutin } from "@clair/data";
import { Badge, Card, formatDossierTitre, Link, parseStatut, StatutBadge } from "@clair/ui";
import { pluriel } from "../shared/scrutins.ts";
import classes from "./ScrutinFicheScreen.module.css";

/**
 * Dossier législatif du scrutin, annoncé avant tout le reste : un vote n'a de sens que replacé
 * dans le texte qu'il fait avancer. Les sources officielles sont proposées à côté.
 */
export const DossierBandeau = ({ dossier }: { dossier: DossierDuScrutin }) => {
  const statut = parseStatut(dossier.etat);
  const nbScrutins = dossier._count?.scrutins ?? 0;
  const nbAmendements = dossier._count?.amendements ?? 0;
  const sources = [
    { label: "Assemblée nationale", url: dossier.urlAN },
    { label: "Sénat", url: dossier.urlSenat },
    { label: "Légifrance", url: dossier.urlLegifrance },
  ].filter((source): source is { label: string; url: string } => Boolean(source.url));

  return (
    <section className={classes.bandeau} aria-labelledby="dossier-du-scrutin">
      <p id="dossier-du-scrutin" className={classes.bandeauTitre}>
        Étape d'un dossier législatif
      </p>
      <Card
        as="div"
        titleAs="h2"
        href={`/dossiers/${encodeURIComponent(dossier.uid)}`}
        title={formatDossierTitre(dossier.titre, dossier.procedureLibelle)}
        eyebrow={
          statut ? (
            <StatutBadge statut={statut} size="sm" />
          ) : dossier.etat ? (
            <Badge tone="neutre" size="sm">
              {dossier.etat}
            </Badge>
          ) : undefined
        }
      >
        <p className={classes.bandeauMeta}>
          {dossier.loiNumero ? <span>Loi n° {dossier.loiNumero}</span> : null}
          {nbScrutins > 0 ? <span>{pluriel(nbScrutins, "scrutin")}</span> : null}
          {nbAmendements > 0 ? <span>{pluriel(nbAmendements, "amendement")}</span> : null}
        </p>
      </Card>
      {sources.length > 0 ? (
        <p className={classes.mention}>
          Sources officielles :{" "}
          {sources.map((source, index) => (
            <span key={source.label}>
              {index > 0 ? " · " : null}
              <Link href={source.url} external>
                {source.label}
              </Link>
            </span>
          ))}
        </p>
      ) : null}
    </section>
  );
};
