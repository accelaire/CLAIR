'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Search,
  TrendingUp,
  Users,
  Vote,
  Building2,
  BarChart3,
  PieChart,
  GitBranch,
  Sparkles,
  ChevronRight,
  Filter,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';

// Components
import { QuickQuestions } from './components/QuickQuestions';
import { VotingTrendsChart } from './components/VotingTrendsChart';
import { GroupDistributionChart } from './components/GroupDistributionChart';
import { TopDeputesChart } from './components/TopDeputesChart';
import { LobbyingSectorsChart } from './components/LobbyingSectorsChart';
import { ScrutinsHeatmap } from './components/ScrutinsHeatmap';
import { InsightCard } from './components/InsightCard';

// Types
export type ViewMode = 'overview' | 'deputes' | 'scrutins' | 'lobbying' | 'custom';
export type ChartType = 'bar' | 'pie' | 'line' | 'heatmap' | 'network';

interface ExplorerState {
  view: ViewMode;
  filters: {
    groupe?: string;
    periode?: string;
    theme?: string;
  };
  selectedQuestion?: string;
}

export default function ExplorateurPage() {
  const [state, setState] = useState<ExplorerState>({
    view: 'overview',
    filters: {},
  });

  // Fetch overview stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['explorer-stats'],
    queryFn: () => api.get('/analytics/stats').then((res) => res.data.data),
  });

  // Fetch groupes for filters
  const { data: groupes } = useQuery({
    queryKey: ['groupes'],
    queryFn: () => api.get('/groupes').then((res) => res.data.data),
  });

  const handleQuestionSelect = (questionId: string, view: ViewMode) => {
    setState((s) => ({ ...s, selectedQuestion: questionId, view }));
  };

  const handleFilterChange = (key: string, value: string | undefined) => {
    setState((s) => ({
      ...s,
      filters: { ...s.filters, [key]: value },
    }));
  };

  const clearFilters = () => {
    setState((s) => ({ ...s, filters: {} }));
  };

  const activeFiltersCount = Object.values(state.filters).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Explorateur
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              Beta
            </span>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            Explorez les données de l&apos;Assemblée nationale de manière interactive.
            Découvrez les tendances de vote, analysez l&apos;activité des députés et
            visualisez l&apos;influence du lobbying.
          </p>
        </div>

        {/* Quick Questions */}
        <QuickQuestions
          onSelect={handleQuestionSelect}
          selectedQuestion={state.selectedQuestion}
        />

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>Filtres</span>
          </div>

          {/* Groupe filter */}
          <select
            value={state.filters.groupe || ''}
            onChange={(e) => handleFilterChange('groupe', e.target.value || undefined)}
            className="px-3 py-1.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Tous les groupes</option>
            {groupes?.map((g: any) => (
              <option key={g.id} value={g.slug}>{g.nom}</option>
            ))}
          </select>

          {/* Periode filter */}
          <select
            value={state.filters.periode || ''}
            onChange={(e) => handleFilterChange('periode', e.target.value || undefined)}
            className="px-3 py-1.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Toutes périodes</option>
            <option value="2024">2024</option>
            <option value="2023">2023</option>
            <option value="2022">2022</option>
          </select>

          {/* Theme filter */}
          <select
            value={state.filters.theme || ''}
            onChange={(e) => handleFilterChange('theme', e.target.value || undefined)}
            className="px-3 py-1.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Tous les thèmes</option>
            <option value="budget">Budget</option>
            <option value="securite">Sécurité</option>
            <option value="sante">Santé</option>
            <option value="environnement">Environnement</option>
            <option value="education">Éducation</option>
          </select>

          {activeFiltersCount > 0 && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-3 w-3" />
              Effacer ({activeFiltersCount})
            </button>
          )}
        </div>

        {/* View Mode Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-muted/50 w-fit mb-8">
          {[
            { id: 'overview', label: 'Vue d\'ensemble', icon: BarChart3 },
            { id: 'deputes', label: 'Députés', icon: Users },
            { id: 'scrutins', label: 'Scrutins', icon: Vote },
            { id: 'lobbying', label: 'Lobbying', icon: Building2 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setState((s) => ({ ...s, view: tab.id as ViewMode }))}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                state.view === tab.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Main Content */}
        {state.view === 'overview' && (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InsightCard
                icon={Users}
                label="Députés"
                value={stats?.totalDeputes || '-'}
                trend={null}
              />
              <InsightCard
                icon={Vote}
                label="Scrutins"
                value={stats?.totalScrutins || '-'}
                trend={null}
              />
              <InsightCard
                icon={Building2}
                label="Lobbyistes"
                value={stats?.totalLobbyistes || '-'}
                trend={null}
              />
              <InsightCard
                icon={TrendingUp}
                label="Actions lobbying"
                value={stats?.totalActions || '-'}
                trend={null}
              />
            </div>

            {/* Charts Grid */}
            <div className="grid lg:grid-cols-2 gap-6">
              <GroupDistributionChart filters={state.filters} />
              <VotingTrendsChart filters={state.filters} />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <TopDeputesChart filters={state.filters} />
              <LobbyingSectorsChart filters={state.filters} />
            </div>
          </div>
        )}

        {state.view === 'deputes' && (
          <div className="space-y-6">
            <TopDeputesChart filters={state.filters} expanded />
            <div className="grid lg:grid-cols-2 gap-6">
              <GroupDistributionChart filters={state.filters} />
              <ScrutinsHeatmap filters={state.filters} />
            </div>
          </div>
        )}

        {state.view === 'scrutins' && (
          <div className="space-y-6">
            <VotingTrendsChart filters={state.filters} expanded />
            <ScrutinsHeatmap filters={state.filters} expanded />
          </div>
        )}

        {state.view === 'lobbying' && (
          <div className="space-y-6">
            <LobbyingSectorsChart filters={state.filters} expanded />
            <div className="grid lg:grid-cols-2 gap-6">
              <TopDeputesChart filters={state.filters} title="Députés les plus ciblés" />
              <GroupDistributionChart filters={state.filters} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
