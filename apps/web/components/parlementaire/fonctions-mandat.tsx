'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { FonctionRattachable } from '@/lib/fonctions-par-mandat';

export interface FonctionItem extends FonctionRattachable {
  id: string;
  typeOrgane: string;
  institution: string | null;
  qualite: string | null;
  commission?: { slug: string; nom: string; chambre: string } | null;
}

const VISIBLES = 4;

function moisAnnee(date: string): string {
  return new Date(date).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
}

function Fonction({ f }: { f: FonctionItem }) {
  const libelle = f.commission?.nom || f.institution || f.typeOrgane;
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{f.qualite || 'Membre'}</p>
        {f.commission ? (
          <Link href={`/commissions/${f.commission.slug}`} className="text-sm text-primary hover:underline line-clamp-2">
            {libelle}
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">{libelle}</p>
        )}
      </div>
      <div className="text-xs text-muted-foreground text-right flex-shrink-0">
        <p>{moisAnnee(f.dateDebut)}</p>
        <p>{f.dateFin ? moisAnnee(f.dateFin) : 'en cours'}</p>
      </div>
    </div>
  );
}

/**
 * Fonctions d'UN mandat parlementaire. Sous le mandat en cours : les fonctions
 * actives, puis les fonctions terminées repliées. Sous un mandat passé : tout
 * replié, la frise reste lisible.
 */
export function FonctionsMandat({ fonctions, enCours }: { fonctions: FonctionItem[]; enCours: boolean }) {
  const [toutesActives, setToutesActives] = useState(false);
  const [terminees, setTerminees] = useState(false);
  if (fonctions.length === 0) return null;

  const actives = fonctions.filter((f) => !f.dateFin);
  const closes = fonctions.filter((f) => !!f.dateFin);
  // Sous un mandat passé, une fonction encore ouverte reste une donnée à
  // montrer : elle rejoint la liste repliée plutôt que de disparaître.
  const visibles = enCours ? actives : [];
  const repliees = enCours ? closes : fonctions;

  return (
    <div className="mt-3">
      {visibles.length > 0 && (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {(toutesActives ? visibles : visibles.slice(0, VISIBLES)).map((f) => (
              <Fonction key={f.id} f={f} />
            ))}
          </div>
          {visibles.length > VISIBLES && (
            <div className="mt-2">
              <button
                onClick={() => setToutesActives((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {toutesActives ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    Réduire
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    Voir {visibles.length - VISIBLES} de plus
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}
      {repliees.length > 0 && (
        <div className={visibles.length > 0 ? 'mt-3' : ''}>
          <button
            onClick={() => setTerminees((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${terminees ? 'rotate-180' : ''}`} />
            {enCours ? 'Anciennes fonctions' : 'Fonctions'} ({repliees.length})
          </button>
          {terminees && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2 opacity-70">
              {repliees.map((f) => (
                <Fonction key={f.id} f={f} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
