/**
 * Résultats des sénatoriales du 27 septembre 2026 : libellés, état de la soirée et géométrie de
 * l'hémicycle (repris de apps/web `lib/senatoriales/resultats.ts`, `lib/hemicycle-geometrie.ts`
 * et des composants de résultats). Les chiffres sont PROVISOIRES : chaque affichage le rappelle,
 * avec la source et l'heure de mise à jour.
 */
import type {
  Elu,
  EtapeSecondTour,
  ResultatsCirconscription,
  ResultatsNationaux,
  StatutCirconscription,
} from "@clair/data";
import { resultatsEnDirect } from "./calendrier.ts";
import { FAMILLES } from "./familles.ts";

/** Libellé court de l'état d'une circonscription, celui des vignettes. */
export const libelleStatut = (
  statut: StatutCirconscription,
  secondTour: EtapeSecondTour | null,
): string => {
  switch (statut) {
    case "pas_ouvert":
      return "Vote pas encore ouvert";
    case "vote_en_cours":
      return "Vote en cours";
    case "resultats_attendus":
      return "Résultats attendus";
    case "second_tour":
      return secondTour === "en_cours"
        ? "2nd tour en cours"
        : secondTour === "clos"
          ? "2nd tour clos, résultats attendus"
          : "2nd tour à venir";
    case "partielle":
      return "Résultats partiels";
    case "pourvue":
      return "Résultats connus";
  }
};

/** Fiche d'un élu : la définitive s'il en a une, sinon la provisoire. */
export const lienElu = (e: Pick<Elu, "personne" | "slug">): string | null => {
  if (e.personne) {
    return `/${e.personne.chambre === "senat" ? "senateurs" : "deputes"}/${e.personne.slug}`;
  }
  return e.slug ? `/senateurs/${e.slug}` : null;
};

/** Badge du parcours d'un élu : ce que CLAIR sait de lui avant son élection. */
export const libelleParcours = (elu: Pick<Elu, "parcours" | "avant" | "sexe">): string => {
  const f = elu.sexe === "F";
  if (elu.parcours === "reelu") return f ? "réélue" : "réélu";
  if (elu.parcours === "parlementaire" && elu.avant) {
    if (elu.avant.chambre === "assemblee") {
      return elu.avant.enCours
        ? f
          ? "députée"
          : "député"
        : f
          ? "ancienne députée"
          : "ancien député";
    }
    return f ? "ancienne sénatrice" : "ancien sénateur";
  }
  return f ? "nouvelle au Parlement" : "nouveau au Parlement";
};

/**
 * Catégories de l'hémicycle. Les familles positionnées s'étagent de gauche à droite sur l'arc ;
 * les autres ne se placent pas sur un axe gauche-droite et sont comptées à part.
 */
export const FAMILLES_ARC = [
  "gauche",
  "centre",
  "droite",
  "droite_ou_extreme_droite",
  "extreme_droite",
] as const;
export const HORS_ARC = [
  "regionaliste",
  "divers",
  "non_classee",
  "non_publiee",
  "non_attribue",
] as const;

export const CATEGORIES_HEMICYCLE: Record<string, { libelle: string; couleur: string }> = {
  ...FAMILLES,
  non_classee: { libelle: "Nuance non classée", couleur: "#9ca3af" },
  non_publiee: { libelle: "Nuance non publiée", couleur: "#6b7280" },
  non_attribue: { libelle: "Siège non attribué", couleur: "transparent" },
};

/** Circonscriptions d'outre-mer dont les horaires sont convertis en heure de Paris. */
export const OUTRE_MER = ["973", "977", "978", "986", "987"] as const;

/**
 * Le scrutin a-t-il commencé quelque part ? Tant qu'aucune circonscription n'a ouvert ses
 * bureaux (le premier : Wallis-et-Futuna, le samedi à 22h30 heure de Paris), la page reste
 * celle des candidats et du bilan.
 */
export const scrutinCommence = (
  donnees: ResultatsNationaux | null | undefined,
): donnees is ResultatsNationaux =>
  Boolean(donnees?.circonscriptions.some((c) => c.statut !== "pas_ouvert"));

/** Un premier résultat est-il publié ? */
export const resultatsPublies = (donnees: ResultatsNationaux): boolean => {
  const c = donnees.compteurs;
  return c.pourvue + c.partielle + c.second_tour > 0;
};

/** Tous les sièges sont-ils attribués ? */
export const resultatsComplets = (donnees: ResultatsNationaux): boolean =>
  donnees.compteurs.pourvue === donnees.compteurs.circonscriptions;

/**
 * La page nationale se tient-elle à jour d'elle-même ? Une circonscription restée en suspens
 * (recours, page jamais publiée) ne doit pas faire rafraîchir la page indéfiniment.
 */
export const directNational = (donnees: ResultatsNationaux | null | undefined): boolean =>
  scrutinCommence(donnees) &&
  !resultatsComplets(donnees) &&
  resultatsEnDirect(new Date(donnees.maintenant));

/**
 * La page d'une circonscription se tient-elle à jour d'elle-même ? Tant que les bureaux sont
 * ouverts ou que des sièges restent à attribuer, dans la fenêtre du direct.
 */
export const directCirconscription = (
  resultats: ResultatsCirconscription | null | undefined,
): boolean => {
  const statut = resultats?.circonscription.statut;
  return (
    resultats !== null &&
    resultats !== undefined &&
    statut !== "pas_ouvert" &&
    statut !== "pourvue" &&
    resultatsEnDirect(new Date(resultats.maintenant))
  );
};

/** Chapeau du bloc des résultats nationaux, selon l'heure et l'avancement. */
export const chapeauNational = (d: ResultatsNationaux): string => {
  const c = d.compteurs;
  if (c.pourvue === c.circonscriptions) {
    return `Les ${c.sieges} sièges remis en jeu sont attribués. Les élus prennent leurs fonctions le 1er octobre ; les groupes politiques se constituent le 5.`;
  }
  const maintenant = new Date(d.maintenant).getTime();
  const avantMidi = maintenant < new Date("2026-09-27T12:00:00+02:00").getTime();
  const avantSoir = maintenant < new Date("2026-09-27T17:30:00+02:00").getTime();
  if (!resultatsPublies(d)) {
    return avantMidi
      ? "Premiers résultats attendus vers midi, pour le 1er tour au scrutin majoritaire. Le reste suivra en soirée."
      : "Les résultats du 1er tour au scrutin majoritaire sont attendus.";
  }
  if (avantSoir) {
    return "Le 1er tour au scrutin majoritaire est connu. Prochaine vague en soirée : 2nd tours et scrutin proportionnel.";
  }
  return "Les résultats arrivent circonscription par circonscription. L'outre-mer suit dans la nuit, la Polynésie française lundi matin.";
};

export type EtatEtape = "fait" | "en_cours" | "a_venir";

export type EtapeJournee = { heure: string; libelle: string; etat: EtatEtape };

/** Heure de Paris le jour du scrutin, en instant absolu. */
const a = (heure: string, jour = "27") => new Date(`2026-09-${jour}T${heure}:00+02:00`).getTime();

/** Le déroulé de la journée du scrutin, heure de Paris. */
export const etapesJournee = (donnees: ResultatsNationaux): EtapeJournee[] => {
  const t = new Date(donnees.maintenant).getTime();
  const outreMer = new Set<string>(OUTRE_MER);
  const metropoleComplete = donnees.circonscriptions
    .filter((c) => !outreMer.has(c.departement))
    .every((c) => c.statut === "pourvue");
  const toutComplet = resultatsComplets(donnees);

  const liste: { heure: string; libelle: string; fait: boolean; commence: boolean }[] = [
    {
      heure: "7h30",
      libelle: "Wallis-et-Futuna pourvue",
      fait: t >= a("07:30"),
      commence: t >= a("01:00"),
    },
    {
      heure: "11h",
      libelle: "Fin du 1er tour au majoritaire",
      fait: t >= a("11:00"),
      commence: t >= a("11:00"),
    },
    {
      heure: "vers 12h",
      libelle: "Résultats du 1er tour",
      fait: t >= a("12:00"),
      commence: t >= a("11:00"),
    },
    {
      heure: "15h30 → 17h30",
      libelle: "2nd tour au majoritaire",
      fait: t >= a("17:30"),
      commence: t >= a("15:30"),
    },
    {
      heure: "17h30",
      libelle: "Fin du vote à la proportionnelle",
      fait: t >= a("17:30"),
      commence: t >= a("17:30"),
    },
    {
      heure: "en soirée",
      libelle: "Résultats de la métropole",
      fait: metropoleComplete,
      commence: t >= a("17:30"),
    },
    {
      heure: "22h30 → lun. 5h30",
      libelle: "Outre-mer : Guyane, Saint-Barthélemy, Saint-Martin, Polynésie",
      fait: toutComplet,
      commence: t >= a("22:30"),
    },
  ];

  return liste.map((e) => ({
    heure: e.heure,
    libelle: e.libelle,
    etat: e.fait ? "fait" : e.commence ? "en_cours" : "a_venir",
  }));
};

export type PositionSiege = { x: number; y: number; angle: number; row: number };

/**
 * Géométrie d'un hémicycle : la position de chaque siège, rangés de la gauche (angle π) vers la
 * droite (angle 0), colonne par colonne. Même calcul que l'hémicycle de apps/web, pour que les
 * deux dessins du même Sénat placent les sièges au même endroit.
 */
export const positionsHemicycle = (
  totalSeats: number,
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number,
): PositionSiege[] => {
  const numRows = totalSeats > 500 ? 12 : totalSeats > 400 ? 10 : 8;
  const rowSpacing = (outerRadius - innerRadius) / numRows;

  const rowCapacities: number[] = [];
  let totalCapacity = 0;
  for (let row = 0; row < numRows; row++) {
    const rowRadius = innerRadius + row * rowSpacing + rowSpacing / 2;
    const capacity = Math.floor((Math.PI * rowRadius) / (rowSpacing * 0.65));
    rowCapacities.push(capacity);
    totalCapacity += capacity;
  }

  const seatsPerRow: number[] = [];
  let remainingSeats = totalSeats;
  for (let row = 0; row < numRows; row++) {
    if (row === numRows - 1) {
      seatsPerRow.push(remainingSeats);
    } else {
      const proportion = (rowCapacities[row] ?? 0) / totalCapacity;
      const seatsInRow = Math.min(Math.round(totalSeats * proportion), remainingSeats);
      seatsPerRow.push(seatsInRow);
      remainingSeats -= seatsInRow;
    }
  }

  const positions: PositionSiege[] = [];
  for (let row = 0; row < numRows; row++) {
    const rowRadius = innerRadius + row * rowSpacing + rowSpacing / 2;
    const numSeatsInRow = seatsPerRow[row] ?? 0;
    for (let i = 0; i < numSeatsInRow; i++) {
      const angle = Math.PI - (i / (numSeatsInRow - 1 || 1)) * Math.PI;
      positions.push({
        x: centerX + rowRadius * Math.cos(angle),
        y: centerY - rowRadius * Math.sin(angle),
        angle,
        row,
      });
    }
  }

  positions.sort((p, q) => q.angle - p.angle);
  return positions;
};
