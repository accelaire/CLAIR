'use client';

import Link from 'next/link';
import { ArrowRight, ExternalLink, Layers } from 'lucide-react';
import { formatDossierTitre, getDossierEtat } from '@/lib/dossiers';

export interface ScrutinDossier {
  id: string;
  uid: string;
  titre: string;
  titreCourt: string | null;
  procedureLibelle: string | null;
  urlAN: string | null;
  urlSenat: string | null;
  etat: string | null;
  dateDepot: string | null;
  loiNumero: string | null;
  loiTitre: string | null;
  urlLegifrance: string | null;
  _count?: { scrutins: number; amendements: number };
}

const pluriel = (n: number, mot: string) =>
  `${n.toLocaleString('fr-FR')} ${mot}${n > 1 ? 's' : ''}`;

/**
 * Un scrutin n'a de sens que replacé dans le texte qu'il fait avancer : le
 * dossier est donc annoncé en pleine largeur, avant le résumé, plutôt que comme
 * une ligne de métadonnée parmi d'autres dans la colonne latérale.
 */
export function ScrutinDossierBanner({ dossier }: { dossier: ScrutinDossier }) {
  const etat = getDossierEtat(dossier.etat);
  const nbScrutins = dossier._count?.scrutins ?? 0;
  const nbAmendements = dossier._count?.amendements ?? 0;

  const sources = [
    { label: 'Assemblée nationale', url: dossier.urlAN },
    { label: 'Sénat', url: dossier.urlSenat },
    { label: 'Légifrance', url: dossier.urlLegifrance },
  ].filter((s): s is { label: string; url: string } => Boolean(s.url));

  return (
    <section className="mb-8 overflow-hidden rounded-xl border border-primary/30 bg-primary/5">
      <Link
        href={`/dossiers/${dossier.uid}`}
        className="group flex items-start gap-3 p-4 transition-colors hover:bg-primary/10 sm:p-5"
      >
        <Layers className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Étape d&apos;un dossier législatif
          </p>
          <h2 className="mt-1 text-base font-semibold leading-snug group-hover:underline sm:text-lg">
            {formatDossierTitre(dossier.titre, dossier.procedureLibelle)}
          </h2>
          <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
              {etat && (
                <span className={`inline-flex rounded-full px-2 py-0.5 ${etat.color}`}>
                  {etat.label}
                </span>
              )}
              {dossier.loiNumero && (
                <span className="font-medium text-foreground">Loi n°{dossier.loiNumero}</span>
              )}
              {nbAmendements > 0 && <span>{pluriel(nbAmendements, 'amendement')}</span>}
            </div>
            <p className="flex shrink-0 items-center justify-end gap-1 text-sm font-medium text-primary">
              {nbScrutins > 1
                ? `Voir les ${nbScrutins.toLocaleString('fr-FR')} votes de ce dossier`
                : 'Voir le parcours de ce texte'}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </p>
          </div>
        </div>
      </Link>

      {sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-primary/20 px-4 py-2 text-xs text-muted-foreground sm:px-5">
          <span className="text-muted-foreground/70">Sources officielles</span>
          {sources.map((source) => (
            <a
              key={source.label}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
            >
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              {source.label}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
