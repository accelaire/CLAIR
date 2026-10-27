import { Badge } from "../badge/Badge.tsx";
import { STATUTS, type Statut } from "./statuts.ts";

export type StatutBadgeProps = {
  statut: Statut;
  /** Libellé plus précis que celui du statut (« Irrecevable (art. 40) »), ton inchangé. */
  label?: string;
  size?: "sm" | "md";
};

/**
 * Statut législatif : sort d'un scrutin ou d'un amendement, état d'un dossier. Le ton vient du
 * mapping central `STATUTS` ; le libellé porte toujours l'information (jamais la couleur seule).
 * Pour une valeur brute de l'API, passer par `parseStatut`.
 * Remplace `AmendementSortBadge` et les classes `.badge-*` de statut de apps/web.
 */
export const StatutBadge = ({ statut, label, size = "md" }: StatutBadgeProps) => {
  const definition = STATUTS[statut];
  return (
    <Badge tone={definition.tone} size={size}>
      {label ?? definition.label}
    </Badge>
  );
};
