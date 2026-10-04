import React from "react";

export interface VoteBadgeProps {
  position: "POUR" | "CONTRE" | "ABSTENTION" | "NON_VOTANT" | "ABSENT";
  count?: number;
}

export function VoteBadge({ position, count }: VoteBadgeProps) {
  switch (position) {
    case "POUR":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>Pour</span>
          {count !== undefined && <span className="font-mono font-bold">({count})</span>}
        </span>
      );
    case "CONTRE":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-300 dark:border-red-800">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          <span>Contre</span>
          {count !== undefined && <span className="font-mono font-bold">({count})</span>}
        </span>
      );
    case "ABSTENTION":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          <span>Abstention</span>
          {count !== undefined && <span className="font-mono font-bold">({count})</span>}
        </span>
      );
    case "NON_VOTANT":
    case "ABSENT":
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          <span>Non-votant</span>
          {count !== undefined && <span className="font-mono font-bold">({count})</span>}
        </span>
      );
  }
}
