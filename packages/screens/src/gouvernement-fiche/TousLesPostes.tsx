import type { PosteMinisteriel } from "@clair/data";
import { NomMembre } from "../shared/gouvernements/ElementsGouvernement.tsx";
import {
  dateLongue,
  intituleAffiche,
  libellePoste,
  RANGS,
  titreDuRang,
} from "../shared/gouvernements/gouvernements.ts";
import classes from "./GouvernementFicheScreen.module.css";

/**
 * La liste complète des postes, par rang protocolaire, avec les dates et l'identifiant de chaque
 * poste dans la source (reprise de `TousLesPostes`, apps/web).
 */
export const TousLesPostes = ({ postes }: { postes: readonly PosteMinisteriel[] }) => {
  const sections = [
    ...RANGS.map((r) => ({
      titre: r.titre,
      postes: postes.filter((p) => r.rangs.includes(p.rangProtocolaire)),
    })),
    {
      titre: "Autres membres",
      postes: postes.filter((p) => titreDuRang(p.rangProtocolaire) === "Autres membres"),
    },
  ].filter((s) => s.postes.length > 0);
  return (
    <div className={classes.pile}>
      {sections.map((s) => (
        <section key={s.titre} aria-label={s.titre}>
          <h2 className={classes.sousTitre}>
            {s.titre} <span className={classes.mentionEnLigne}>({s.postes.length})</span>
          </h2>
          <ul className={classes.listeSimple}>
            {s.postes.map((p) => {
              const portefeuille = intituleAffiche(p.intituleCourt, p.intitule);
              return (
                <li key={p.uid} className={classes.posteLigne}>
                  <div>
                    <p className={classes.ligne}>
                      <span className={classes.fort}>
                        <NomMembre personne={p.membre} />
                      </span>{" "}
                      · {libellePoste(p.qualite, p.intituleCourt, p.intitule)}
                    </p>
                    {p.intitule.toLowerCase() !== portefeuille.toLowerCase() ? (
                      <p className={classes.mention}>{p.intitule}</p>
                    ) : null}
                  </div>
                  <div className={classes.posteDates}>
                    <p className={classes.mention}>
                      {dateLongue(p.dateDebut)} → {p.dateFin ? dateLongue(p.dateFin) : "en cours"}
                    </p>
                    <p className={classes.code}>{p.uid}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
};
