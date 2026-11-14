'use client';

import type { ReactNode } from 'react';
import { useOngletAncre } from '@/lib/use-onglet-ancre';

export interface Onglet {
  /** Ancre de l'URL (`#textes`) : partageable, sans paramètre qui rendrait la page dynamique. */
  cle: string;
  libelle: string;
  /** Affiché dans une pastille, comme les onglets d'un scrutin (« 23 · 30 »). */
  compte?: string | number;
  contenu: ReactNode;
}

/**
 * Onglets d'une page rendue côté serveur, sur le modèle de la page d'un
 * scrutin. Tous les panneaux sont dans le HTML (les moteurs et les lecteurs
 * sans JavaScript voient tout le contenu) ; seul le panneau actif est visible.
 * L'onglet ouvert suit l'ancre de l'URL (`useOngletAncre`).
 */
export function Onglets({ onglets, etiquette }: { onglets: Onglet[]; etiquette: string }) {
  const { actif, choisir, barre } = useOngletAncre(
    onglets.map((o) => o.cle),
    onglets[0]?.cle ?? '',
  );

  return (
    <div>
      <div ref={barre} className="mb-6 scroll-mt-20 overflow-x-auto border-b">
        <div role="tablist" aria-label={etiquette} className="flex gap-0">
          {onglets.map((o) => {
            const estActif = o.cle === actif;
            return (
              <button
                key={o.cle}
                id={`onglet-${o.cle}`}
                role="tab"
                type="button"
                aria-selected={estActif}
                aria-controls={`panneau-${o.cle}`}
                onClick={() => choisir(o.cle)}
                // Un onglet ne rétrécit ni ne passe à la ligne : la barre défile.
                className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  estActif
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground'
                }`}
              >
                {o.libelle}
                {o.compte !== undefined && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs ${estActif ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
                  >
                    {o.compte}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {onglets.map((o) => (
        <div
          key={o.cle}
          id={`panneau-${o.cle}`}
          role="tabpanel"
          aria-labelledby={`onglet-${o.cle}`}
          hidden={o.cle !== actif}
        >
          {o.contenu}
        </div>
      ))}
    </div>
  );
}
