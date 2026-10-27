import type { CSSProperties } from "react";
import classes from "./GroupeBadge.module.css";

export type GroupeBadgeProps = {
  /** Sigle du groupe (« LFI », « EPR », « RDPI »), toujours affiché. */
  sigle: string;
  /** Nom complet du groupe, lu par les lecteurs d'écran et proposé en infobulle. */
  nom?: string | null;
  /**
   * Couleur du groupe telle que la publie l'API (`groupe.couleur` : « #CC2443 » ou « 204,36,67 »).
   * Absente ou invalide : repli sur le token `--clair-groupe-<sigle>`, puis sur le gris des non-inscrits.
   */
  couleur?: string | null;
  size?: "sm" | "md";
};

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB = /^(\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})$/;
/** Le noir est la valeur par défaut des sources, pas une vraie couleur de groupe. */
const NOIR = /^#0{3}(?:0{3})?$/;

/**
 * Couleur d'un groupe pour une pastille : la donnée de l'API si elle est exploitable,
 * sinon le token du sigle, sinon le gris des non-inscrits.
 */
export const couleurGroupe = (sigle: string, couleur?: string | null): string => {
  const valeur = couleur?.trim() ?? "";
  if (HEX.test(valeur) && !NOIR.test(valeur)) return valeur;
  const rgb = RGB.exec(valeur);
  if (rgb && valeur.replace(/[\s,]/g, "") !== "000") {
    return `rgb(${rgb[1]}, ${rgb[2]}, ${rgb[3]})`;
  }
  const token = sigle
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `var(--clair-groupe-${token}, var(--clair-groupe-ni))`;
};

/**
 * Groupe politique : pastille de couleur et sigle, toujours affiché (la couleur n'est jamais seule).
 * Le nom complet est lu par les lecteurs d'écran. Remplace `.groupe-badge` et `getGroupColor`.
 */
export const GroupeBadge = ({ sigle, nom, couleur, size = "md" }: GroupeBadgeProps) => {
  const style: CSSProperties & { "--groupe-couleur": string } = {
    "--groupe-couleur": couleurGroupe(sigle, couleur),
  };
  return (
    <span className={classes.badge} data-size={size} title={nom ?? undefined} style={style}>
      <span className={classes.pastille} aria-hidden="true" />
      {sigle}
      {nom && nom !== sigle ? <span className="clair-visually-hidden">, {nom}</span> : null}
    </span>
  );
};
