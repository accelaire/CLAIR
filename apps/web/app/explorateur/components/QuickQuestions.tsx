'use client';

import { useState } from 'react';
import {
  TrendingDown,
  Users,
  Scale,
  Building2,
  Zap,
  Award,
  AlertTriangle,
  Target,
} from 'lucide-react';
import type { ViewMode } from '../page';

interface QuickQuestion {
  id: string;
  label: string;
  description: string;
  icon: typeof TrendingDown;
  color: string;
  view: ViewMode;
}

const QUICK_QUESTIONS: QuickQuestion[] = [
  {
    id: 'dissidents',
    label: 'Qui vote contre son groupe ?',
    description: 'Députés votant différemment de leur groupe',
    icon: TrendingDown,
    color: 'from-red-500/20 to-red-500/5',
    view: 'deputes',
  },
  {
    id: 'actifs',
    label: 'Députés les plus actifs',
    description: 'Par nombre de votes et interventions',
    icon: Zap,
    color: 'from-amber-500/20 to-amber-500/5',
    view: 'deputes',
  },
  {
    id: 'controverses',
    label: 'Scrutins controversés',
    description: 'Votes serrés et divisions internes',
    icon: AlertTriangle,
    color: 'from-orange-500/20 to-orange-500/5',
    view: 'scrutins',
  },
  {
    id: 'consensus',
    label: 'Votes unanimes',
    description: 'Quand tout le monde est d\'accord',
    icon: Users,
    color: 'from-green-500/20 to-green-500/5',
    view: 'scrutins',
  },
  {
    id: 'top-lobbies',
    label: 'Top lobbies',
    description: 'Organisations les plus actives',
    icon: Building2,
    color: 'from-blue-500/20 to-blue-500/5',
    view: 'lobbying',
  },
  {
    id: 'lobbying-cibles',
    label: 'Cibles du lobbying',
    description: 'Qui est le plus sollicité ?',
    icon: Target,
    color: 'from-purple-500/20 to-purple-500/5',
    view: 'lobbying',
  },
  {
    id: 'equilibre',
    label: 'Équilibre politique',
    description: 'Répartition gauche/droite',
    icon: Scale,
    color: 'from-indigo-500/20 to-indigo-500/5',
    view: 'overview',
  },
  {
    id: 'nouveaux',
    label: 'Nouveaux députés',
    description: 'Première législature',
    icon: Award,
    color: 'from-cyan-500/20 to-cyan-500/5',
    view: 'deputes',
  },
];

interface QuickQuestionsProps {
  onSelect: (questionId: string, view: ViewMode) => void;
  selectedQuestion?: string;
}

export function QuickQuestions({ onSelect, selectedQuestion }: QuickQuestionsProps) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-medium text-muted-foreground mb-3">
        Questions rapides
      </h2>
      <div className="flex flex-wrap gap-2">
        {QUICK_QUESTIONS.map((q) => {
          const Icon = q.icon;
          const isSelected = selectedQuestion === q.id;

          return (
            <button
              key={q.id}
              onClick={() => onSelect(q.id, q.view)}
              className={`group relative inline-flex items-center gap-2 px-4 py-2 rounded-xl border transition-all hover:shadow-md ${
                isSelected
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-transparent bg-gradient-to-br ' + q.color + ' hover:border-border'
              }`}
            >
              <Icon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
              <span className={`text-sm font-medium ${isSelected ? 'text-primary' : ''}`}>
                {q.label}
              </span>

              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-popover border shadow-lg text-xs text-muted-foreground whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10">
                {q.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
