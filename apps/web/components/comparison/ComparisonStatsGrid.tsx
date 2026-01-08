'use client';

import { Users, Vote, MessageSquare, FileText, UserCheck, Activity, Award } from 'lucide-react';

interface ParlementaireStats {
  slug: string;
  nom: string;
  prenom: string;
  stats: {
    presence: number;
    presenceSolennel: number | null;
    loyaute: number;
    participation: number;
    interventions: number;
    amendements: { proposes: number; adoptes: number };
    questions?: number;
  };
}

interface ComparisonStatsGridProps {
  parlementaires: ParlementaireStats[];
}

interface StatRowProps {
  label: string;
  icon: React.ReactNode;
  values: { value: number | string; slug: string }[];
  format?: 'percent' | 'number' | 'fraction';
  isHigherBetter?: boolean;
}

function StatRow({ label, icon, values, format = 'number', isHigherBetter = true }: StatRowProps) {
  // Trouver les valeurs min/max pour highlighting
  const numericValues = values.map((v) =>
    typeof v.value === 'number' ? v.value : parseFloat(v.value.toString()) || 0
  );
  const maxValue = Math.max(...numericValues);
  const minValue = Math.min(...numericValues);
  const hasVariance = maxValue !== minValue;

  return (
    <div className="grid gap-2 sm:gap-4 min-w-fit" style={{ gridTemplateColumns: `minmax(100px, 140px) repeat(${values.length}, minmax(70px, 1fr))` }}>
      {/* Label */}
      <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>

      {/* Valeurs */}
      {values.map((v, i) => {
        const numValue = numericValues[i];
        const isBest = hasVariance && numValue === (isHigherBetter ? maxValue : minValue);
        const isWorst = hasVariance && numValue === (isHigherBetter ? minValue : maxValue);

        let displayValue: string;
        if (format === 'percent') {
          displayValue = `${Math.round(numValue)}%`;
        } else if (format === 'fraction') {
          displayValue = v.value.toString();
        } else {
          displayValue = numValue.toLocaleString('fr-FR');
        }

        return (
          <div
            key={v.slug}
            className={`flex flex-col items-center justify-center rounded-lg p-2 sm:p-3 ${
              isBest
                ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                : isWorst
                ? 'bg-orange-500/10 text-orange-700 dark:text-orange-400'
                : 'bg-muted/50'
            }`}
          >
            <span className="text-base sm:text-xl font-bold">{displayValue}</span>
            {format === 'percent' && (
              <div className="mt-1 h-1.5 w-full max-w-20 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${
                    isBest ? 'bg-green-500' : isWorst ? 'bg-orange-500' : 'bg-primary'
                  }`}
                  style={{ width: `${numValue}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ComparisonStatsGrid({ parlementaires }: ComparisonStatsGridProps) {
  if (parlementaires.length === 0) return null;

  // Vérifier si on a des données de présence solennelle
  const hasPresenceSolennel = parlementaires.some((p) => p.stats.presenceSolennel !== null);

  const stats = [
    {
      label: 'Présence',
      icon: <UserCheck className="h-4 w-4" />,
      format: 'percent' as const,
      getValue: (p: ParlementaireStats) => p.stats.presence,
    },
    // Présence solennelle (affichée uniquement si des données existent)
    ...(hasPresenceSolennel
      ? [
          {
            label: 'Présence solennelle',
            icon: <Award className="h-4 w-4" />,
            format: 'percent' as const,
            getValue: (p: ParlementaireStats) => p.stats.presenceSolennel ?? 0,
          },
        ]
      : []),
    {
      label: 'Loyauté groupe',
      icon: <Users className="h-4 w-4" />,
      format: 'percent' as const,
      getValue: (p: ParlementaireStats) => p.stats.loyaute,
    },
    {
      label: 'Participations',
      icon: <Vote className="h-4 w-4" />,
      format: 'number' as const,
      getValue: (p: ParlementaireStats) => p.stats.participation,
    },
    {
      label: 'Interventions',
      icon: <MessageSquare className="h-4 w-4" />,
      format: 'number' as const,
      getValue: (p: ParlementaireStats) => p.stats.interventions,
    },
    {
      label: 'Amendements',
      icon: <FileText className="h-4 w-4" />,
      format: 'fraction' as const,
      getValue: (p: ParlementaireStats) =>
        `${p.stats.amendements.adoptes}/${p.stats.amendements.proposes}`,
      getNumericValue: (p: ParlementaireStats) =>
        p.stats.amendements.proposes > 0
          ? (p.stats.amendements.adoptes / p.stats.amendements.proposes) * 100
          : 0,
    },
  ];

  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Activity className="h-5 w-5" />
        Statistiques
      </h2>

      <div className="rounded-lg border bg-card p-3 sm:p-4 overflow-x-auto">
        {/* En-tête avec noms */}
        <div
          className="mb-3 sm:mb-4 grid gap-2 sm:gap-4 border-b pb-3 sm:pb-4 min-w-fit"
          style={{ gridTemplateColumns: `minmax(100px, 140px) repeat(${parlementaires.length}, minmax(70px, 1fr))` }}
        >
          <div /> {/* Cellule vide pour l'alignement */}
          {parlementaires.map((p) => (
            <div key={p.slug} className="text-center">
              <span className="text-xs sm:text-sm font-semibold leading-tight block">
                {p.prenom}
                <br className="sm:hidden" />
                <span className="sm:before:content-['_']">{p.nom}</span>
              </span>
            </div>
          ))}
        </div>

        {/* Lignes de stats */}
        <div className="space-y-3">
          {stats.map((stat) => (
            <StatRow
              key={stat.label}
              label={stat.label}
              icon={stat.icon}
              format={stat.format}
              values={parlementaires.map((p) => ({
                value: stat.getValue(p),
                slug: p.slug,
              }))}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
