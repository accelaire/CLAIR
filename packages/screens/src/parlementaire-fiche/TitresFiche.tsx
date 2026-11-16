import type { ParlementaireDetail } from "@clair/data";
import { Link } from "@clair/ui";
import { fonctionsEnVue, titresDeLaFiche } from "../shared/gouvernements/fonctions-en-vue.ts";
import { dateLongue, fonctionEnCours } from "../shared/gouvernements/gouvernements.ts";
import classes from "./TitresFiche.module.css";

/**
 * Titres d'un élu sous son nom (reprise de `titres-fiche.tsx`, apps/web, master c89cfaf) : le
 * poste au Gouvernement en cours d'abord, lié à la page du gouvernement, puis la présidence de
 * l'assemblée, d'une commission ou d'un groupe. Sans eux, rien ne disait que Gérard Larcher
 * préside le Sénat (#118), ni que la fiche d'un sénateur d'un mois est celle du Premier ministre.
 */
export const TitresFiche = ({
  fiche,
}: {
  fiche: Pick<ParlementaireDetail, "fonctionsGouvernementales" | "sexe" | "mandats">;
}) => {
  const titres = titresDeLaFiche(
    fonctionEnCours(fiche.fonctionsGouvernementales, fiche.sexe),
    fonctionsEnVue(fiche.mandats ?? []),
  );
  if (titres.length === 0) return null;
  return (
    <ul className={classes.titres} aria-label="Fonctions en cours">
      {titres.map((t) => (
        <li key={t.titre} className={classes.titre}>
          <span className={classes.fort}>{t.titre}</span>
          {t.depuis ? (
            <span className={classes.depuis}>depuis le {dateLongue(t.depuis)}</span>
          ) : null}
          {t.lien ? <Link href={t.lien.href}>{t.lien.libelle}</Link> : null}
        </li>
      ))}
    </ul>
  );
};
