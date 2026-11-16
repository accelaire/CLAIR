"use client";

import { useApiQuery } from "@clair/api-client";
import type { BilanPoste, FonctionGouvernementale, MembreGouvernementReponse } from "@clair/data";
import { Button, Link } from "@clair/ui";
import { useId, useState } from "react";
import { MotionLigne, ProjetLigne } from "../shared/gouvernements/ElementsGouvernement.tsx";
import { dateLongue, nombre } from "../shared/gouvernements/gouvernements.ts";
import classes from "./BilanPoste.module.css";

/** La ligne de résumé d'un poste : textes portés et réponses en séance ; 49.3 et motions pour un PM. */
export const resumeBilanPoste = (b: BilanPoste): string[] => {
  const morceaux: string[] = [];
  if (b.textes) {
    const c = b.textes.chefDeFile;
    if (c.portes > 0) {
      morceaux.push(
        `${nombre(c.portes, "texte porté", "textes portés")}, ${
          c.parStadePortes.promulgue > 0
            ? `dont ${nombre(c.parStadePortes.promulgue, "promulgué")}`
            : "aucun promulgué"
        }`,
      );
    }
    const aPart = c.parNature.ratification_ordonnance + c.parNature.convention;
    if (aPart > 0) {
      morceaux.push(nombre(aPart, "ratification ou convention", "ratifications ou conventions"));
    }
    if (b.textes.cosignataire > 0) {
      morceaux.push(nombre(b.textes.cosignataire, "texte cosigné", "textes cosignés"));
    }
  }
  const reponses = b.reponses.assemblee + b.reponses.senat;
  if (reponses > 0) morceaux.push(nombre(reponses, "réponse en séance", "réponses en séance"));
  if (b.premierMinistre) {
    morceaux.push(nombre(b.premierMinistre.engagements, "recours au 49.3", "recours au 49.3"));
    morceaux.push(nombre(b.premierMinistre.motions, "motion de censure", "motions de censure"));
  }
  return morceaux;
};

/** Le détail d'un poste, chargé à l'ouverture (`/gouvernements/membres/:slug`). */
const DetailPoste = ({
  f,
  membreSlug,
  id,
}: {
  f: FonctionGouvernementale;
  membreSlug: string;
  id: string;
}) => {
  const membre = useApiQuery<MembreGouvernementReponse>(
    `/gouvernements/membres/${encodeURIComponent(membreSlug)}`,
  );
  if (membre.isPending) {
    return (
      <p id={id} className={classes.mention} role="status">
        Chargement…
      </p>
    );
  }
  if (membre.isError) {
    return (
      <p id={id} className={classes.mention}>
        Le détail n'a pas pu être chargé.
      </p>
    );
  }
  const detail = membre.data.data.postes.find((p) => p.uid === f.uid)?.bilan;
  const textes = detail?.textes?.liste ?? [];
  const engagements = detail?.premierMinistre?.listeEngagements ?? [];
  const motions = detail?.premierMinistre?.listeMotions ?? [];
  return (
    <div id={id} className={classes.detail}>
      {engagements.length > 0 ? (
        <div>
          <p className={classes.surtitre}>Recours au 49.3</p>
          <ul className={classes.liste}>
            {engagements.map((e) => {
              const texte = e.texte ?? e.dossier;
              return (
                <li key={`${e.date}-${e.dossier.uid}`}>
                  {dateLongue(e.date)} · <Link href={`/dossiers/${texte.uid}`}>{texte.titre}</Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {motions.length > 0 ? (
        <div>
          <p className={classes.surtitre}>Motions de censure contre son gouvernement</p>
          <ul className={classes.liste}>
            {motions.map((m) => (
              <MotionLigne
                key={`${m.scrutin.chambre}-${m.scrutin.session}-${m.scrutin.numero}`}
                motion={m}
              />
            ))}
          </ul>
        </div>
      ) : null}
      {textes.length > 0 ? (
        <div>
          <p className={classes.surtitre}>Projets de loi signés</p>
          <ul className={classes.liste}>
            {textes.map((t) => (
              <ProjetLigne key={t.dossier.uid} projet={t} role={t.role} />
            ))}
          </ul>
        </div>
      ) : engagements.length === 0 && motions.length === 0 ? (
        <p className={classes.mention}>Aucun projet de loi signé.</p>
      ) : null}
    </div>
  );
};

/**
 * Bilan d'un poste ministériel (reprise de `BilanPosteLigne`, apps/web, master d3cf002), sous
 * son entrée dans la frise des mandats : le résumé vient avec la fiche, la liste des textes et
 * des 49.3 se charge à l'ouverture.
 */
export const BilanPosteLigne = ({ f }: { f: FonctionGouvernementale }) => {
  const [ouvert, setOuvert] = useState(false);
  const id = useId();
  if (!f.bilan) return null;
  const morceaux = resumeBilanPoste(f.bilan);
  if (morceaux.length === 0) return null;
  return (
    <div className={classes.bilan}>
      <p className={classes.mention}>{morceaux.join(" · ")}</p>
      {f.membreSlug ? (
        <>
          <Button
            variant="tertiaire"
            size="sm"
            onClick={() => setOuvert((o) => !o)}
            aria-expanded={ouvert}
            aria-controls={ouvert ? id : undefined}
          >
            {ouvert ? "Masquer le détail" : "Voir le détail"}
          </Button>
          {ouvert ? <DetailPoste f={f} membreSlug={f.membreSlug} id={id} /> : null}
        </>
      ) : null}
    </div>
  );
};

/** Le poste a un bilan à résumer (sinon rien n'est ajouté sous son entrée). */
export const aUnBilan = (f: FonctionGouvernementale): boolean =>
  f.bilan ? resumeBilanPoste(f.bilan).length > 0 : false;

/** Provenance des bilans de postes, sous la frise : des comptes calculés par CLAIR. */
export const ProvenanceBilanPostes = () => (
  <p className={classes.mention}>
    Bilan de chaque poste calculé par CLAIR depuis juin 2017, à partir des dossiers législatifs et
    des scrutins publiés par l'Assemblée nationale et le Sénat.
  </p>
);
