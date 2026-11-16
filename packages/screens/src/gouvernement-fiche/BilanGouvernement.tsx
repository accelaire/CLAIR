import type { BilanGouvernement, DomaineMinisteriel, MotionCensure } from "@clair/data";
import { Link } from "@clair/ui";
import { MotionLigne, ProjetLigne } from "../shared/gouvernements/ElementsGouvernement.tsx";
import { dateLongue, nombre } from "../shared/gouvernements/gouvernements.ts";
import classes from "./GouvernementFicheScreen.module.css";

const cleMotion = (m: MotionCensure) =>
  `${m.scrutin.chambre}-${m.scrutin.session}-${m.scrutin.numero}`;

const aPart = (nature: string) => nature === "ratification_ordonnance" || nature === "convention";

/**
 * Projets de loi d'un gouvernement (reprise de `BilanTextes`, apps/web) : les textes portés par
 * domaine du ministre chef de file, puis les ratifications d'ordonnances et les conventions,
 * comptées à part.
 */
export const BilanTextes = ({
  bilan,
  domaines,
}: {
  bilan: BilanGouvernement;
  domaines: readonly DomaineMinisteriel[];
}) => {
  const { textes } = bilan;
  if (textes.total === 0) {
    return <p className={classes.mention}>Aucun projet de loi déposé pendant ce gouvernement.</p>;
  }
  const portes = textes.liste.filter((p) => !aPart(p.nature));
  const ratifications = textes.liste.filter((p) => aPart(p.nature));
  const s = textes.parStadePortes;

  // Rangés par domaine du ministre chef de file, dans l'ordre de présentation d'un
  // gouvernement ; « Premier ministre seul » à la fin.
  const libelleDomaine = new Map(domaines.map((d) => [d.cle, d.libelle]));
  const groupes = new Map<string, typeof portes>();
  for (const p of portes) {
    const cle = p.chefDeFile ? (p.chefDeFile.domaine ?? "autres") : "premier-ministre-seul";
    groupes.set(cle, [...(groupes.get(cle) ?? []), p]);
  }
  const ordre = [...domaines.map((d) => d.cle), "autres", "premier-ministre-seul"];
  const connues = new Set(ordre);
  // Un domaine que la liste ne connaît pas encore passe avec les autres portefeuilles.
  for (const [cle, projets] of groupes) {
    if (!connues.has(cle)) {
      groupes.set("autres", [...(groupes.get("autres") ?? []), ...projets]);
      groupes.delete(cle);
    }
  }
  const sections = ordre.flatMap((cle) => {
    const projets = groupes.get(cle);
    if (!projets) return [];
    const titre =
      cle === "premier-ministre-seul"
        ? "Signés du Premier ministre seul"
        : cle === "autres"
          ? "Autres portefeuilles"
          : (libelleDomaine.get(cle) ?? cle);
    return [{ cle, titre, projets }];
  });

  return (
    <div className={classes.pile}>
      {textes.portes > 0 ? (
        <p className={classes.mention}>
          Sur {nombre(textes.portes, "texte porté", "textes portés")} :{" "}
          {nombre(s.promulgue, "promulgué")}
          {s.adopte > 0 ? `, ${nombre(s.adopte, "adopté")} sans promulgation connue` : ""},{" "}
          {nombre(s.examine, "examiné")} sans adoption définitive, {s.depose} jamais{" "}
          {s.depose > 1 ? "examinés" : "examiné"} en séance.
        </p>
      ) : null}

      {sections.map((sec) => (
        <section key={sec.cle} aria-labelledby={`textes-${sec.cle}`}>
          <h2 id={`textes-${sec.cle}`} className={classes.sousTitre}>
            {sec.titre} <span className={classes.mentionEnLigne}>({sec.projets.length})</span>
          </h2>
          <ul className={classes.listeSimple}>
            {sec.projets.map((p) => (
              <ProjetLigne key={p.dossier.uid} projet={p} porteur={p.chefDeFile?.membre} />
            ))}
          </ul>
        </section>
      ))}

      {ratifications.length > 0 ? (
        <details className={classes.details}>
          <summary className={classes.fort}>
            Ratifications d’ordonnances et conventions ({ratifications.length})
          </summary>
          <p className={classes.mention}>
            Comptées à part. Déposer le projet de ratification d’une ordonnance est une obligation
            de l’article 38 de la Constitution, sous peine de caducité de l’ordonnance : la plupart
            ne sont jamais examinés, et le gouvernement qui le dépose n’est pas toujours celui qui a
            pris l’ordonnance.
          </p>
          <ul className={classes.listeSimple}>
            {ratifications.map((p) => (
              <ProjetLigne key={p.dossier.uid} projet={p} porteur={p.chefDeFile?.membre} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
};

/** Le jour civil dix jours après `jour`. */
const dixJoursApres = (jour: string) => {
  const fin = new Date(`${jour}T12:00:00Z`);
  fin.setUTCDate(fin.getUTCDate() + 10);
  return fin.toISOString().slice(0, 10);
};

/** Recours au 49.3 et motions de censure (reprise de `BilanCensure`, apps/web), en frise. */
export const BilanCensure = ({ bilan }: { bilan: BilanGouvernement }) => {
  const { engagements, motions } = bilan;
  const spontanees = motions.liste.filter((m) => m.alinea === 2);
  const sansEngagement = motions.liste.filter((m) => m.alinea === 3 && !m.engagementDossierUid);
  // Les motions sans engagement identifié votées dans les 10 jours d'un 49.3.
  const sansEngagementApres = (jour: string) => {
    const borne = dixJoursApres(jour);
    return sansEngagement.filter((m) => m.date >= jour && m.date <= borne);
  };

  if (engagements.length === 0 && motions.total === 0) {
    return (
      <p className={classes.mention}>
        Aucun recours au 49.3 ni motion de censure pendant ce gouvernement.
      </p>
    );
  }

  return (
    <div className={classes.pile}>
      {engagements.length > 0 ? (
        <section aria-labelledby="titre-engagements">
          <h2 id="titre-engagements" className={classes.sousTitre}>
            Recours à l’article 49, alinéa 3 ({engagements.length})
          </h2>
          <ol className={classes.rail}>
            {engagements.map((e) => {
              const texte = e.texte ?? e.dossier;
              const voisines = sansEngagementApres(e.date);
              return (
                <li key={`${e.date}-${e.dossier.uid}`} className={classes.railEntree}>
                  <p className={classes.ligne}>
                    <span className={classes.fort}>{dateLongue(e.date)}</span> · 49.3 sur{" "}
                    <Link href={`/dossiers/${texte.uid}`}>{texte.titre}</Link>
                  </p>
                  {e.motions.length > 0 ? (
                    <ul className={classes.listeSimple}>
                      {e.motions.map((m) => (
                        <MotionLigne key={cleMotion(m)} motion={m} />
                      ))}
                    </ul>
                  ) : (
                    <p className={classes.mention}>
                      {voisines[0]
                        ? `Motions votées le ${dateLongue(voisines[0].date)}, sans que la source dise à quel 49.3 chacune répond (voir plus bas).`
                        : "Aucune motion de censure."}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {sansEngagement.length > 0 ? (
        <section aria-labelledby="titre-sans-engagement">
          <h2 id="titre-sans-engagement" className={classes.sousTitre}>
            Motions en réponse à un 49.3 non identifié
          </h2>
          <p className={classes.mention}>
            Deux engagements votés le même jour : la source ne dit pas auquel chaque motion répond.
          </p>
          <ul className={classes.listeSimple}>
            {sansEngagement.map((m) => (
              <MotionLigne key={cleMotion(m)} motion={m} />
            ))}
          </ul>
        </section>
      ) : null}

      {spontanees.length > 0 ? (
        <section aria-labelledby="titre-spontanees">
          <h2 id="titre-spontanees" className={classes.sousTitre}>
            Motions de censure spontanées (article 49, alinéa 2) ({spontanees.length})
          </h2>
          <ul className={classes.listeSimple}>
            {spontanees.map((m) => (
              <MotionLigne key={cleMotion(m)} motion={m} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
};
