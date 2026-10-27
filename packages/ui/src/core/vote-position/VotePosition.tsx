import type { LucideIcon } from "lucide-react";
import { Ban, Minus, ThumbsDown, ThumbsUp, UserX } from "lucide-react";
import classes from "./VotePosition.module.css";

export type VotePositionValue = "pour" | "contre" | "abstention" | "absent" | "non_votant";

export type VotePositionProps = {
  position: VotePositionValue;
  size?: "sm" | "md";
};

export const VOTE_POSITIONS: Record<VotePositionValue, { label: string; icon: LucideIcon }> = {
  pour: { label: "Pour", icon: ThumbsUp },
  contre: { label: "Contre", icon: ThumbsDown },
  abstention: { label: "Abstention", icon: Minus },
  absent: { label: "Absent", icon: UserX },
  non_votant: { label: "Non-votant", icon: Ban },
};

/**
 * Position de vote d'un parlementaire sur un scrutin : icône et libellé, jamais la couleur
 * seule. Fusionne les `VotePositionBadge` dupliqués des fiches député et sénateur de apps/web.
 */
export const VotePosition = ({ position, size = "md" }: VotePositionProps) => {
  const { label, icon: Icon } = VOTE_POSITIONS[position];
  return (
    <span className={classes.badge} data-position={position} data-size={size}>
      <Icon className={classes.icon} aria-hidden="true" />
      {label}
    </span>
  );
};
