import React from "react";

export interface PoliticalBadgeProps {
  groupe: string;
  label?: string;
  chambre?: "AN" | "SENAT";
}

const GROUPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  // Assemblée Nationale
  RN: { bg: "bg-blue-950/40", text: "text-blue-300", border: "border-blue-800" },
  EPR: { bg: "bg-amber-950/40", text: "text-amber-300", border: "border-amber-800" },
  "LFI-NFP": { bg: "bg-red-950/40", text: "text-red-300", border: "border-red-800" },
  SOC: { bg: "bg-pink-950/40", text: "text-pink-300", border: "border-pink-800" },
  DR: { bg: "bg-blue-900/40", text: "text-blue-200", border: "border-blue-700" },
  EcoS: { bg: "bg-emerald-950/40", text: "text-emerald-300", border: "border-emerald-800" },
  Dem: { bg: "bg-orange-950/40", text: "text-orange-300", border: "border-orange-800" },
  HOR: { bg: "bg-cyan-950/40", text: "text-cyan-300", border: "border-cyan-800" },
  LIOT: { bg: "bg-purple-950/40", text: "text-purple-300", border: "border-purple-800" },
  GDR: { bg: "bg-rose-950/40", text: "text-rose-300", border: "border-rose-800" },
  UDR: { bg: "bg-indigo-950/40", text: "text-indigo-300", border: "border-indigo-800" },
  NI: { bg: "bg-slate-800/40", text: "text-slate-300", border: "border-slate-700" },

  // Sénat
  REP: { bg: "bg-blue-900/40", text: "text-blue-200", border: "border-blue-700" },
  SER: { bg: "bg-pink-950/40", text: "text-pink-300", border: "border-pink-800" },
  UC: { bg: "bg-orange-950/40", text: "text-orange-300", border: "border-orange-800" },
  CRCE: { bg: "bg-red-950/40", text: "text-red-300", border: "border-red-800" },
  RDPI: { bg: "bg-amber-950/40", text: "text-amber-300", border: "border-amber-800" },
  GEST: { bg: "bg-emerald-950/40", text: "text-emerald-300", border: "border-emerald-800" },
  RDSE: { bg: "bg-yellow-950/40", text: "text-yellow-300", border: "border-yellow-800" },
  LIRT: { bg: "bg-cyan-950/40", text: "text-cyan-300", border: "border-cyan-800" },
};

export function PoliticalBadge({ groupe, label, chambre }: PoliticalBadgeProps) {
  const style = GROUPE_COLORS[groupe] || {
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-300 dark:border-slate-700",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-bold border ${style.bg} ${style.text} ${style.border}`}
    >
      {chambre && (
        <span className="text-[10px] opacity-75 font-normal">[{chambre}]</span>
      )}
      <span>{groupe}</span>
      {label && <span className="font-sans font-normal text-xs opacity-90">— {label}</span>}
    </span>
  );
}
