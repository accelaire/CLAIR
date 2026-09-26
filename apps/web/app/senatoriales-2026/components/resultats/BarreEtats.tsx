'use client';

import { useState, type PointerEvent } from 'react';
import Link from 'next/link';
import { slugDepuisCode } from '@/lib/senatoriales/departements';
import type { ResumeCirconscription, StatutCirconscription } from '@/lib/senatoriales/resultats';

export interface EtatBarre {
  statut: StatutCirconscription;
  libelle: string;
  classe: string;
  nombre: number;
}

/**
 * La barre des états de la soirée, et quelles circonscriptions sont derrière
 * chacun : au survol à la souris, au toucher sur mobile, au clavier.
 *
 * Le survol n'est écouté que pour une vraie souris. Sur un écran tactile, le
 * navigateur simule un survol au premier toucher : il rouvrirait aussitôt le
 * détail que ce même toucher vient de refermer.
 */
export function BarreEtats({
  etats,
  total,
  circonscriptions,
}: {
  etats: EtatBarre[];
  total: number;
  circonscriptions: Pick<ResumeCirconscription, 'departement' | 'nom' | 'statut'>[];
}) {
  const [survol, setSurvol] = useState<StatutCirconscription | null>(null);
  const [epingle, setEpingle] = useState<StatutCirconscription | null>(null);
  const affiche = survol ?? epingle;
  const etatAffiche = etats.find((e) => e.statut === affiche);
  const liste = affiche
    ? circonscriptions.filter((c) => c.statut === affiche).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    : [];

  const entree = (statut: StatutCirconscription) => (e: PointerEvent) => {
    if (e.pointerType === 'mouse') setSurvol(statut);
  };
  const sortie = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') setSurvol(null);
  };
  const basculer = (statut: StatutCirconscription) => {
    setSurvol(null);
    setEpingle((actuel) => (actuel === statut ? null : statut));
  };

  // La sortie est écoutée sur l'ensemble, et non sur chaque état : la souris
  // doit pouvoir descendre de la légende jusqu'aux liens du détail.
  return (
    <div className="space-y-3" onPointerLeave={sortie}>
      <div className="flex h-2.5 w-full gap-px overflow-hidden rounded-full bg-muted">
        {etats.map((o) => (
          <button
            key={o.statut}
            type="button"
            tabIndex={-1}
            aria-hidden
            className={`h-full transition-opacity ${o.classe} ${affiche && affiche !== o.statut ? 'opacity-30' : ''}`}
            style={{ width: `${(o.nombre / total) * 100}%` }}
            onPointerEnter={entree(o.statut)}
            onClick={() => basculer(o.statut)}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-1 gap-y-1 text-xs text-muted-foreground">
        {etats.map((o) => (
          <li key={o.statut}>
            <button
              type="button"
              aria-expanded={affiche === o.statut}
              aria-controls="detail-etats"
              className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors hover:bg-muted ${
                affiche === o.statut ? 'bg-muted text-foreground' : ''
              }`}
              onPointerEnter={entree(o.statut)}
              onClick={() => basculer(o.statut)}
            >
              <span className={`h-2.5 w-2.5 rounded-sm ${o.classe}`} aria-hidden />
              {o.libelle} <span className="font-semibold text-foreground">{o.nombre}</span>
            </button>
          </li>
        ))}
      </ul>
      <div id="detail-etats" aria-live="polite">
        {etatAffiche ? (
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium text-foreground">
              {etatAffiche.libelle} : {etatAffiche.nombre}
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {liste.map((c) => {
                const slug = slugDepuisCode(c.departement);
                return (
                  <li key={c.departement}>
                    {slug ? (
                      <Link
                        href={`/senatoriales-2026/${slug}`}
                        className="inline-block rounded border bg-card px-2 py-0.5 text-xs hover:border-primary"
                      >
                        {c.nom}
                      </Link>
                    ) : (
                      <span className="inline-block rounded border bg-card px-2 py-0.5 text-xs">{c.nom}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/80">
            Survolez ou touchez un état pour voir les circonscriptions concernées.
          </p>
        )}
      </div>
    </div>
  );
}
