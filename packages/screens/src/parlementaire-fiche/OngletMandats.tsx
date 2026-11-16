import type {
  FonctionGouvernementale,
  FonctionParlementaire,
  MandatParlementaire,
  ParlementaireDetail,
} from "@clair/data";
import {
  type Mandat,
  type MandatFonction,
  MandatsTimeline,
  type PosteGouvernemental,
} from "@clair/ui";
import { libellePoste } from "../shared/gouvernements/gouvernements.ts";
import { groupeHref, libelleLegislature } from "../shared/parlementaires/chambre.ts";
import { aUnBilan, BilanPosteLigne, ProvenanceBilanPostes } from "./BilanPoste.tsx";

export const periodeDe = (mandat: MandatParlementaire) => {
  if (mandat.legislature !== null) return libelleLegislature(mandat.legislature);
  if (mandat.mandature !== null) return `Mandature ${mandat.mandature}`;
  return mandat.chambre === "senat" ? "Mandat de sénateur" : "Mandat de député";
};

export const versFonction = (fonction: FonctionParlementaire): MandatFonction => ({
  id: fonction.id,
  qualite: fonction.qualite,
  organe: fonction.commission?.nom ?? fonction.institution ?? fonction.typeOrgane,
  href: fonction.commission ? `/commissions/${fonction.commission.slug}` : undefined,
  dateDebut: fonction.dateDebut,
  dateFin: fonction.dateFin,
});

/** La fonction a commencé pendant le mandat. */
const pendant = (fonction: FonctionParlementaire, mandat: MandatParlementaire) =>
  fonction.dateDebut >= mandat.dateDebut &&
  (mandat.dateFin === null || fonction.dateDebut <= mandat.dateFin);

/**
 * Mandats pour la frise : chaque fonction (commission, délégation…) est rattachée au mandat
 * pendant lequel elle a commencé, à défaut au plus récent.
 */
export const mandatsDeLaFiche = (fiche: ParlementaireDetail): Mandat[] => {
  const recents = [...fiche.mandatsParlementaires].sort((a, b) =>
    b.dateDebut.localeCompare(a.dateDebut),
  );
  const fonctions = new Map<string, FonctionParlementaire[]>();
  for (const fonction of fiche.mandats) {
    const mandat = recents.find((candidat) => pendant(fonction, candidat)) ?? recents[0];
    if (!mandat) continue;
    fonctions.set(mandat.id, [...(fonctions.get(mandat.id) ?? []), fonction]);
  }
  return recents.map((mandat) => ({
    id: mandat.id,
    chambre: mandat.chambre,
    periode: periodeDe(mandat),
    dateDebut: mandat.dateDebut,
    dateFin: mandat.dateFin,
    groupe: mandat.groupe
      ? {
          sigle: mandat.groupe.nom,
          nom: mandat.groupe.nom,
          couleur: mandat.groupe.couleur,
          href: groupeHref(mandat.chambre, mandat.groupe.slug),
        }
      : null,
    circonscription: mandat.circonscription
      ? `${mandat.circonscription.nom} (${mandat.circonscription.departement})`
      : null,
    fonctions: (fonctions.get(mandat.id) ?? []).map(versFonction),
  }));
};

/**
 * Postes au Gouvernement et présidence de la République pour la frise (reprise
 * d'`EntreeGouvernementale`, apps/web) : libellé du poste, gouvernement lié, bilan dessous.
 */
export const postesDeLaFiche = (
  fonctions: readonly FonctionGouvernementale[],
): PosteGouvernemental[] =>
  fonctions.map((f) => ({
    id: f.uid,
    nature: f.type === "presidence" ? "presidence" : "gouvernement",
    libelle:
      f.type === "presidence" ? f.qualite : libellePoste(f.qualite, f.intituleCourt, f.intitule),
    dateDebut: f.dateDebut,
    dateFin: f.dateFin,
    gouvernement: f.gouvernement
      ? { nom: f.gouvernement.nom, href: `/gouvernements/${f.gouvernement.slug}` }
      : null,
    details: aUnBilan(f) ? <BilanPosteLigne f={f} /> : undefined,
  }));

const sexeDe = (sexe: string | null): "F" | "M" | null =>
  sexe === "F" || sexe === "M" ? sexe : null;

/**
 * Onglet « Mandats » : une seule frise, du plus récent au plus ancien, des mandats (avec leurs
 * fonctions) et des postes au Gouvernement (avec leur bilan), comme `MandatsBlock` d'apps/web.
 */
export const OngletMandats = ({ fiche }: { fiche: ParlementaireDetail }) => {
  const fonctions = fiche.fonctionsGouvernementales ?? [];
  return (
    <>
      <MandatsTimeline
        mandats={mandatsDeLaFiche(fiche)}
        postes={postesDeLaFiche(fonctions)}
        sexe={sexeDe(fiche.sexe)}
        title="Mandats et fonctions"
      />
      {fonctions.some(aUnBilan) ? <ProvenanceBilanPostes /> : null}
    </>
  );
};
