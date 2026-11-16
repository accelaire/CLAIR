import type { ParlementaireDetail } from "@clair/data";
import { Card, Link, ProvenanceLabel } from "@clair/ui";
import { formatDate } from "../shared/parlementaires/chambre.ts";
import { TYPES_DECLARATION } from "./OngletDeclarations.tsx";
import { periodeDe, versFonction } from "./OngletMandats.tsx";
import classes from "./ParlementaireFicheScreen.module.css";

/** Fonctions en cours montrées dans l'aperçu (apps/web en montrait quatre avant « Voir plus »). */
const FONCTIONS_MAX = 4;
/** Déclarations montrées dans l'aperçu : les plus récentes. */
const DECLARATIONS_MAX = 2;

const pluriel = (nombre: number, mot: string, motPluriel = `${mot}s`) =>
  `${nombre} ${nombre > 1 ? motPluriel : mot}`;

export type FicheApercuProps = {
  fiche: ParlementaireDetail;
  /** Lien vers l'onglet « Mandats ». */
  mandatsHref: string;
  /** Lien vers l'onglet « Déclarations HATVP ». */
  declarationsHref: string;
};

/**
 * Aperçu, hors des onglets, du mandat le plus récent (avec ses fonctions en cours) et des
 * dernières déclarations HATVP, visibles à l'arrivée sur la fiche comme dans apps/web. Le détail
 * reste dans les onglets « Mandats » et « Déclarations HATVP ».
 */
export const FicheApercu = ({ fiche, mandatsHref, declarationsHref }: FicheApercuProps) => {
  const mandat = [...fiche.mandatsParlementaires]
    .sort((a, b) => b.dateDebut.localeCompare(a.dateDebut))
    .at(0);
  const fonctions = fiche.mandats
    .filter((fonction) => fonction.dateFin === null)
    .sort((a, b) => b.dateDebut.localeCompare(a.dateDebut))
    .map(versFonction);
  const declarations = [...fiche.declarations]
    .sort((a, b) => (b.datePublication ?? "").localeCompare(a.datePublication ?? ""))
    .slice(0, DECLARATIONS_MAX);
  if (!mandat && declarations.length === 0) return null;

  return (
    <section className={classes.section} aria-label="Mandat et déclarations">
      <div className={classes.grilleDeux}>
        {mandat ? (
          <Card
            as="section"
            titleAs="h2"
            title={mandat.dateFin === null ? "Mandat en cours" : "Dernier mandat"}
            footer={
              <Link href={mandatsHref}>
                Voir {pluriel(fiche.mandatsParlementaires.length, "mandat")} et les fonctions
              </Link>
            }
          >
            <p className={classes.texte}>
              {periodeDe(mandat)}
              {mandat.dateFin === null
                ? `, depuis le ${formatDate(mandat.dateDebut)}`
                : `, du ${formatDate(mandat.dateDebut)} au ${formatDate(mandat.dateFin)}`}
            </p>
            {fonctions.length > 0 ? (
              <ul className={classes.apercuListe} aria-label="Fonctions en cours">
                {fonctions.slice(0, FONCTIONS_MAX).map((fonction) => (
                  <li key={fonction.id}>
                    {fonction.qualite ? <span>{fonction.qualite} · </span> : null}
                    {fonction.href ? (
                      <Link href={fonction.href}>{fonction.organe}</Link>
                    ) : (
                      fonction.organe
                    )}
                  </li>
                ))}
                {fonctions.length > FONCTIONS_MAX ? (
                  <li className={classes.compte}>
                    et{" "}
                    {pluriel(
                      fonctions.length - FONCTIONS_MAX,
                      "autre fonction",
                      "autres fonctions",
                    )}{" "}
                    en cours
                  </li>
                ) : null}
              </ul>
            ) : null}
          </Card>
        ) : null}
        {declarations.length > 0 ? (
          <Card
            as="section"
            titleAs="h2"
            title="Déclarations HATVP"
            footer={
              <Link href={declarationsHref}>
                Voir {pluriel(fiche.declarations.length, "déclaration")}
              </Link>
            }
          >
            <ProvenanceLabel
              provenance="officielle"
              source="Haute Autorité pour la transparence de la vie publique"
            />
            <ul className={classes.apercuListe}>
              {declarations.map((declaration) => (
                <li key={declaration.id}>
                  {declaration.urlDossier ? (
                    <Link href={declaration.urlDossier} external>
                      {TYPES_DECLARATION[declaration.typeDocument] ?? declaration.typeDocument}
                    </Link>
                  ) : (
                    (TYPES_DECLARATION[declaration.typeDocument] ?? declaration.typeDocument)
                  )}
                  {declaration.datePublication ? (
                    <span className={classes.compte}>
                      {" "}
                      · publiée le {formatDate(declaration.datePublication)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </section>
  );
};
