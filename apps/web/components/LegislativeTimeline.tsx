'use client';

import { useState } from 'react';
import {
  LegislativeStep,
  stepDotColor,
  stepConnectorColor,
  outcomeLabel,
  outcomeBadgeColor,
} from '@/lib/legislative-steps';
import { DidacticielTooltip } from '@/components/ui/didacticiel-tooltip';

interface LegislativeTimelineProps {
  steps: LegislativeStep[];
}

const chambreLabel = (chambre: LegislativeStep['chambre']): string => {
  if (chambre === 'assemblee') return 'AN';
  if (chambre === 'senat') return 'Sénat';
  return 'AN + Sénat';
};

const chambreColor = (chambre: LegislativeStep['chambre']): string => {
  if (chambre === 'assemblee')
    return 'badge-assemblee border border-purple-300 dark:border-purple-800';
  if (chambre === 'senat')
    return 'badge-senat border border-blue-300 dark:border-blue-800';
  return 'border-primary/30 bg-primary/5 text-primary';
};

const formatStepDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export function LegislativeTimeline({ steps }: LegislativeTimelineProps) {
  const [activeCode, setActiveCode] = useState<string | null>(null);

  if (steps.length === 0) return null;

  const activeStep = steps.find(s => s.code === activeCode) ?? null;

  return (
    <div className="rounded-lg border bg-card p-5">
      <h2 className="text-sm font-semibold flex items-center gap-2 mb-5">
        <svg
          className="h-4 w-4 text-muted-foreground"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
        Parcours parlementaire
        <DidacticielTooltip
          content="Le parcours d'un texte de loi entre l'Assemblée nationale et le Sénat, jusqu'à sa promulgation. Un texte peut faire plusieurs allers-retours (navette) avant d'être adopté ou rejeté."
          learnMoreHref="/comprendre/dossier-legislatif"
          learnMoreLabel="Comprendre le parcours législatif"
          position="bottom"
        />
      </h2>

      <div className="overflow-x-auto pt-1 pb-2 -mx-1 px-1">
        <div
          className="flex items-start"
          style={{ minWidth: `${steps.length * 120}px` }}
        >
          {steps.map((step, i) => {
            const nextStep = steps[i + 1];
            const connectorColor = nextStep ? stepConnectorColor(nextStep) : '';
            const label = outcomeLabel(step.outcome);
            const badgeColor = outcomeBadgeColor(step.outcome);
            const isActive = activeCode === step.code;

            return (
              <div key={step.code} className="flex items-start flex-1 last:flex-none">
                {/* Step column */}
                <button
                  type="button"
                  className={`flex flex-col items-center flex-shrink-0 rounded-md transition-colors focus:outline-none ${
                    step.detail ? 'cursor-pointer hover:bg-muted/40' : 'cursor-default'
                  } ${isActive ? 'bg-muted/40' : ''}`}
                  style={{ minWidth: '80px' }}
                  onClick={() => step.detail ? setActiveCode(isActive ? null : step.code) : undefined}
                  onMouseEnter={() => step.detail && setActiveCode(step.code)}
                  onMouseLeave={() => setActiveCode(null)}
                  aria-label={step.detail ? `${step.label} — ${step.detail}` : step.label}
                >
                  <div
                    className={`h-3.5 w-3.5 rounded-full border-2 border-background shadow-sm ${stepDotColor(step)}`}
                  />
                  <span
                    className={`mt-2.5 text-[11px] font-semibold text-center leading-tight whitespace-nowrap ${
                      step.status === 'pending'
                        ? 'text-muted-foreground/40'
                        : 'text-foreground'
                    }`}
                  >
                    {step.label}
                  </span>
                  {step.date && (
                    <span className="mt-0.5 text-[10px] text-muted-foreground font-medium">
                      {formatStepDate(step.date)}
                    </span>
                  )}
                  <span
                    className={`mt-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded border ${chambreColor(step.chambre)} ${
                      step.status === 'pending' ? 'opacity-30' : ''
                    }`}
                  >
                    {chambreLabel(step.chambre)}
                  </span>
                  {label && (
                    <span className={`mt-1 px-1.5 py-0.5 text-[10px] font-medium rounded ${badgeColor}`}>
                      {label}
                    </span>
                  )}
                </button>

                {/* Connector */}
                {nextStep && (
                  <div className="flex items-center self-start pt-[6px] mx-1 flex-1 min-w-[20px]">
                    {nextStep.status === 'pending' ? (
                      <div className="h-0.5 w-full border-t-2 border-dashed border-border/60" />
                    ) : (
                      <div className={`h-0.5 w-full rounded-full ${connectorColor}`} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail panel — shown below the timeline when a step with detail is active */}
      {activeStep?.detail && (
        <p className="mt-3 text-xs text-muted-foreground border-t pt-3">
          <span className="font-medium text-foreground">{activeStep.label}</span>
          {' — '}
          {activeStep.detail}
        </p>
      )}
    </div>
  );
}
