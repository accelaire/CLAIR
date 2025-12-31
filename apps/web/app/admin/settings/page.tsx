'use client';

import { Settings, Database, RefreshCw, AlertTriangle } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="text-muted-foreground">
          Configuration de l&apos;administration CLAIR
        </p>
      </div>

      <div className="space-y-6">
        {/* Database */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-100">
              <Database className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold">Base de données</h2>
              <p className="text-sm text-muted-foreground">État de la base de données</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 rounded-lg bg-muted/50">
              <span className="text-muted-foreground">Statut</span>
              <p className="font-medium text-green-600">Connecté</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <span className="text-muted-foreground">Type</span>
              <p className="font-medium">PostgreSQL</p>
            </div>
          </div>
        </div>

        {/* Sync */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-green-100">
              <RefreshCw className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold">Synchronisation</h2>
              <p className="text-sm text-muted-foreground">Gestion de l&apos;ingestion des données</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Pour lancer une synchronisation, utilisez le CLI :
          </p>
          <div className="bg-muted rounded-lg p-3 font-mono text-sm">
            <code>cd services/ingestion && npx tsx src/cli.ts sync --help</code>
          </div>
        </div>

        {/* Danger zone */}
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h2 className="font-semibold text-red-800">Zone dangereuse</h2>
              <p className="text-sm text-red-600">Actions irréversibles</p>
            </div>
          </div>
          <button
            disabled
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium opacity-50 cursor-not-allowed"
          >
            Réinitialiser les données (désactivé)
          </button>
        </div>
      </div>
    </div>
  );
}
