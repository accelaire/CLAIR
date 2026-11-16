import type { Chambre, ParlementaireDetail } from "@clair/data";
import { fonctionEnCours } from "../shared/gouvernements/gouvernements.ts";
import { fonctionDe, formatNombre } from "../shared/parlementaires/chambre.ts";

/** Nombre de mandats distincts dans la chambre de la fiche (législatures ou mandatures). */
export const nombreMandats = (
  fiche: Pick<ParlementaireDetail, "mandatsParlementaires">,
  chambre: Chambre,
) =>
  new Set(
    fiche.mandatsParlementaires
      .filter((mandat) => mandat.chambre === chambre)
      .map((mandat) => (chambre === "senat" ? mandat.mandature : mandat.legislature))
      .filter((cle) => cle !== null),
  ).size;

/** « Bilan de son mandat » ou « Bilan de ses mandats » pour un mandat terminé. */
export const titreBilan = (plusieursMandats: boolean) =>
  plusieursMandats ? "Bilan de ses mandats" : "Bilan de son mandat";

/** Métadonnées d'une fiche (titre et description), pour la route. */
export const metaFiche = (fiche: ParlementaireDetail, chambre: Chambre) => {
  const nom = `${fiche.prenom} ${fiche.nom}`;
  // Une fonction au Gouvernement en cours passe avant le mandat : le lecteur qui cherche le
  // Premier ministre doit le reconnaître dans le résultat (apps/web, master 6324908).
  const gouvernement = fonctionEnCours(fiche.fonctionsGouvernementales, fiche.sexe);
  const mandat = fonctionDe(chambre, fiche.sexe, fiche.actif);
  const fonction = gouvernement ? `${gouvernement.dansUnTitre}, ${mandat}` : mandat;
  const tete = fiche.groupe ? `${nom} (${fiche.groupe.nom}), ${fonction}.` : `${nom}, ${fonction}.`;
  const stats = fiche.stats;
  // Les volumes d'abord (faits bruts) ; la loyauté, qui s'interprète, ferme la liste.
  const metriques = [
    stats?.participation ? `${formatNombre(stats.participation)} votes` : null,
    stats?.interventions ? `${formatNombre(stats.interventions)} interventions` : null,
    stats?.amendements.proposes
      ? `${formatNombre(stats.amendements.proposes)} amendements déposés`
      : null,
    stats?.loyaute ? `${stats.loyaute} % de loyauté au groupe` : null,
  ].filter((metrique) => metrique !== null);
  const cloture = fiche.actif
    ? "Mis à jour chaque jour."
    : `${titreBilan(nombreMandats(fiche, chambre) > 1)}.`;
  const description =
    metriques.length > 0
      ? `${tete} ${metriques.join(", ")}. ${cloture}`
      : `${tete} Ses votes, ses interventions et ses amendements. ${cloture}`;
  return { title: `${nom}, ${fonction} — votes et activité`, description };
};
