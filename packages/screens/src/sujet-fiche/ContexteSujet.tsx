import type { SujetDetail, SujetDossier } from "@clair/data";
import { Card, DossierCard, Link, ProvenanceLabel } from "@clair/ui";
import { compte, formatDate } from "../sujets-liste/format.ts";
import classes from "./SujetFicheScreen.module.css";

/** Premier dossier qui porte une valeur : les infos de la loi sont éclatées entre AN et Sénat. */
const premier = <K extends keyof SujetDossier>(dossiers: SujetDossier[], cle: K) =>
  dossiers.find((d) => d[cle] !== null && d[cle] !== "")?.[cle] ?? null;

/** Liens officiels sans doublon : Légifrance, puis dossiers de l'Assemblée et du Sénat. */
const liensOfficiels = (dossiers: SujetDossier[]) => {
  const vus = new Set<string>();
  const liens: { url: string; label: string }[] = [];
  const ajoute = (url: string | null, label: string) => {
    if (url && !vus.has(url)) {
      vus.add(url);
      liens.push({ url, label });
    }
  };
  for (const d of dossiers) ajoute(d.urlLegifrance, "Consulter sur Légifrance");
  for (const d of dossiers.filter((d) => d.chambre === "assemblee")) {
    ajoute(d.urlAN, "Dossier de l'Assemblée nationale");
  }
  for (const d of dossiers.filter((d) => d.chambre === "senat")) {
    ajoute(d.urlSenat, "Dossier du Sénat");
  }
  return liens;
};

/**
 * Contexte du sujet : résumé et enjeux générés par IA (signalés comme tels), loi promulguée,
 * ou texte en cours d'examen avec ses liens officiels.
 */
export const ContexteSujet = ({
  sujet,
  dossiers,
}: {
  sujet: SujetDetail;
  dossiers: SujetDossier[];
}) => {
  const loiNumero = premier(dossiers, "loiNumero");
  const liens = liensOfficiels(dossiers);
  const procedure = premier(dossiers, "procedureLibelle");

  return (
    <div className={classes.stack}>
      {sujet.resume || sujet.enjeux ? (
        <Card
          as="section"
          titleAs="h2"
          title="En clair"
          eyebrow={
            <ProvenanceLabel provenance="ia" methodologyHref="/methodologie#enrichissement-ia" />
          }
        >
          {sujet.resume ? (
            <>
              <h3 className={classes.subTitle}>Résumé</h3>
              <p className={classes.prose}>{sujet.resume}</p>
            </>
          ) : null}
          {sujet.enjeux ? (
            <>
              <h3 className={classes.subTitle}>Enjeux</h3>
              <p className={classes.prose}>{sujet.enjeux}</p>
            </>
          ) : null}
        </Card>
      ) : null}

      {sujet.status === "promulgue" && loiNumero ? (
        <DossierCard
          as="div"
          titleAs="h2"
          dossier={{
            titre: premier(dossiers, "loiTitre") ?? sujet.label,
            etat: "promulgue",
            loiNumero,
            loiDateJO: premier(dossiers, "loiDateJO"),
            urlLegifrance: premier(dossiers, "urlLegifrance"),
            urlJournalOfficiel: premier(dossiers, "urlJournalOfficiel"),
          }}
        />
      ) : null}

      {sujet.status === "en_cours" ? (
        <Card as="section" titleAs="h2" title="Texte en cours d'examen">
          {procedure ? (
            <p className={classes.prose}>
              Procédure : <strong>{procedure}</strong>
            </p>
          ) : null}
          <p className={classes.prose}>
            {compte(sujet.scrutinCount, "scrutin")} enregistré{sujet.scrutinCount > 1 ? "s" : ""}
            {sujet.dateDernierVote ? `, dernier vote le ${formatDate(sujet.dateDernierVote)}` : ""}.
          </p>
          {liens.length > 0 ? (
            <ul className={classes.links}>
              {liens.map((lien) => (
                <li key={lien.url}>
                  <Link href={lien.url} external>
                    {lien.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
};
