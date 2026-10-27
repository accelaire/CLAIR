"use client";

import { useApiQuery } from "@clair/api-client";
import type { SujetDocumentLie, SujetDossier } from "@clair/data";
import { DossierCard } from "@clair/ui";
import classes from "./SujetFicheScreen.module.css";

/** Dossiers législatifs du sujet (une carte par dossier, lien vers sa fiche). */
export const DossiersSujet = ({ dossiers }: { dossiers: SujetDossier[] }) =>
  dossiers.length === 0 ? null : (
    <section className={classes.panel} aria-labelledby="dossiers-sujet">
      <h2 id="dossiers-sujet" className={classes.panelTitle}>
        Dossiers législatifs{" "}
        <span className={`${classes.count} clair-chiffres`}>({dossiers.length})</span>
      </h2>
      <ul className={classes.list}>
        {dossiers.map((dossier) => (
          <DossierCard
            key={dossier.id}
            as="li"
            href={`/dossiers/${dossier.uid}`}
            dossier={{
              titre: dossier.titre,
              procedureLibelle: dossier.procedureLibelle,
              etat: dossier.etat,
              chambre: dossier.chambre,
              dateDepot: dossier.dateDepot,
              nbScrutins: dossier.scrutinCount,
              loiNumero: dossier.loiNumero,
              loiDateJO: dossier.loiDateJO,
            }}
          />
        ))}
      </ul>
    </section>
  );

/**
 * Rapports d'application et textes sans vote qui citent la loi du sujet : absents de la liste
 * des dossiers (elle exige un scrutin). Rien n'est affiché s'il n'y en a pas.
 */
export const DocumentsLies = ({ slug }: { slug: string }) => {
  const { data } = useApiQuery<{ data: SujetDocumentLie[] }>(
    `/sujets/${encodeURIComponent(slug)}/documents-lies`,
  );
  const documents = data?.data ?? [];
  if (documents.length === 0) return null;
  return (
    <section className={classes.panel} aria-labelledby="documents-lies">
      <h2 id="documents-lies" className={classes.panelTitle}>
        Documents liés{" "}
        <span className={`${classes.count} clair-chiffres`}>({documents.length})</span>
      </h2>
      <p className={classes.mention}>Travaux parlementaires sur cette loi, sans vote propre.</p>
      <ul className={classes.list}>
        {documents.map((doc) => (
          <DossierCard
            key={doc.uid}
            as="li"
            href={`/dossiers/${doc.uid}`}
            dossier={{
              titre: doc.titre,
              procedureLibelle: doc.procedureLibelle,
              chambre: doc.chambre,
              dateDepot: doc.dateDepot,
            }}
          />
        ))}
      </ul>
    </section>
  );
};
