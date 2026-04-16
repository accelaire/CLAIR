// =============================================================================
// Types and helpers for legislative step display
// =============================================================================

// Must match the API response shape
export interface LegislativeStep {
  code: string;
  label: string;
  chambre: 'assemblee' | 'senat' | 'both';
  status: 'done' | 'active' | 'pending';
  outcome:
    | 'adopted'
    | 'adopted_modified'
    | 'adopted_conforme'
    | 'rejected'
    | 'adopted_49_3'
    | 'adopted_definitive'
    | 'cmp_accord'
    | 'cmp_desaccord'
    | 'cc_conforme'
    | 'cc_partiel'
    | 'cc_reserve'
    | null;
  date: string | null;
  detail: string | null;
}

// Dot color for a timeline step
export function stepDotColor(step: LegislativeStep): string {
  if (step.status === 'active') return 'bg-amber-500 animate-pulse';
  if (step.status === 'pending') return 'bg-muted-foreground/30';
  // done — color depends on outcome
  if (step.outcome === 'rejected') return 'bg-red-500';
  if (step.outcome === 'cmp_desaccord') return 'bg-orange-500';
  if (step.outcome === 'cc_partiel' || step.outcome === 'cc_reserve')
    return 'bg-amber-600';
  return 'bg-green-500'; // adopted, conforme, cmp_accord, promulgation, etc.
}

// Connector line color (based on the NEXT step's status/outcome)
export function stepConnectorColor(nextStep: LegislativeStep): string {
  if (nextStep.status === 'pending') return ''; // dashed handled separately
  if (nextStep.status === 'active') return 'bg-amber-400';
  // done
  if (nextStep.outcome === 'rejected') return 'bg-red-400';
  if (nextStep.outcome === 'cmp_desaccord') return 'bg-orange-400';
  if (nextStep.outcome === 'cc_partiel' || nextStep.outcome === 'cc_reserve') return 'bg-amber-500';
  return 'bg-green-400';
}

// French label for outcome
export function outcomeLabel(outcome: LegislativeStep['outcome']): string | null {
  if (!outcome) return null;
  const labels: Record<string, string> = {
    adopted: 'Adopté',
    adopted_modified: 'Modifié',
    adopted_conforme: 'Conforme',
    adopted_49_3: '49.3',
    adopted_definitive: 'Définitif',
    rejected: 'Rejeté',
    cmp_accord: 'Accord',
    cmp_desaccord: 'Désaccord',
    cc_conforme: 'Conforme',
    cc_partiel: 'Partiellement conforme',
    cc_reserve: 'Conforme avec réserve',
  };
  return labels[outcome] ?? null;
}

// Outcome badge color class
export function outcomeBadgeColor(outcome: LegislativeStep['outcome']): string {
  if (!outcome) return '';
  if (outcome === 'rejected')
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  if (outcome === 'cmp_desaccord')
    return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
  if (outcome === 'cc_partiel' || outcome === 'cc_reserve')
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  // All adopted variants, cmp_accord, cc_conforme
  return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
}
