'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3, Users, Vote, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';

interface StatsData {
  totalSessions: number;
  completedSessions: number;
  tauxCompletion: number;
  repartitionProfils: Array<{ profil: string; count: number }>;
}

export default function StatsPage() {
  const { data, isLoading } = useQuery<{ data: StatsData }>({
    queryKey: ['simulateur-stats'],
    queryFn: () => api.get('/simulateur/stats').then((res) => res.data),
  });

  const stats = data?.data;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Statistiques</h1>
        <p className="text-muted-foreground">
          Statistiques d&apos;utilisation du simulateur 2027
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      ) : stats ? (
        <>
          {/* Main stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <span className="text-sm text-muted-foreground">Sessions totales</span>
              </div>
              <div className="text-3xl font-bold">{stats.totalSessions.toLocaleString()}</div>
            </div>

            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-green-100">
                  <Vote className="h-5 w-5 text-green-600" />
                </div>
                <span className="text-sm text-muted-foreground">Sessions complétées</span>
              </div>
              <div className="text-3xl font-bold">{stats.completedSessions.toLocaleString()}</div>
            </div>

            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-amber-100">
                  <TrendingUp className="h-5 w-5 text-amber-600" />
                </div>
                <span className="text-sm text-muted-foreground">Taux de complétion</span>
              </div>
              <div className="text-3xl font-bold">{stats.tauxCompletion}%</div>
            </div>
          </div>

          {/* Profils distribution */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Répartition des profils politiques</h2>
            {stats.repartitionProfils.length === 0 ? (
              <p className="text-muted-foreground">Pas encore de données</p>
            ) : (
              <div className="space-y-3">
                {stats.repartitionProfils.map((item) => {
                  const percentage = stats.completedSessions > 0
                    ? Math.round((item.count / stats.completedSessions) * 100)
                    : 0;
                  return (
                    <div key={item.profil}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{item.profil}</span>
                        <span className="text-muted-foreground">
                          {item.count} ({percentage}%)
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          Impossible de charger les statistiques
        </div>
      )}
    </div>
  );
}
