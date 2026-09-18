// =============================================================================
// La carte d'un dossier législatif
// =============================================================================
//
// POURQUOI UN COMPOSANT PARTAGÉ. La liste des dossiers et l'onglet « Textes &
// Rapports » d'une commission montrent le même objet, et le montraient
// différemment : titre plus petit d'un côté, méta en texte nu au lieu de la
// ligne à icônes, une ligne `titreCourt` en plus. Rapprocher les deux balisages
// les aurait laissés diverger de nouveau au premier changement ; il n'y en a
// donc plus qu'un.
//
// CE QUI RESTE PROPRE À CHAQUE CONTEXTE passe par `badge` : la liste générale
// annonce la chambre, la page d'une commission annonce le rôle de saisine —
// saisie au fond ou pour avis — qui n'a de sens que là.
//
// PAS `titreCourt` : il porte un identifiant technique
// (`pjl_approbation_goteborg`) sur environ 40 % des dossiers portant des
// scrutins. `formatDossierTitre` compose déjà un intitulé lisible.
// =============================================================================

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Calendar, FileText, Vote } from 'lucide-react';
import { DOSSIER_ETAT_CONFIG, formatDossierTitre } from '@/lib/dossiers';

/** Ce qu'il faut d'un dossier pour en faire une carte. Tout est optionnel sauf l'identité. */
export interface DossierDeCarte {
  uid: string;
  titre: string;
  procedureLibelle?: string | null;
  etat?: string | null;
  chambre?: string | null;
  dateDepot?: string | null;
  lastScrutinDate?: string | null;
  loiNumero?: string | null;
  nbScrutins?: number | null;
  nbAmendements?: number | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function DossierCard({
  dossier,
  badge,
}: {
  dossier: DossierDeCarte;
  /** Badge de contexte, posé avant les autres : rôle de saisine, étiquette d'onglet… */
  badge?: ReactNode;
}) {
  const etatCfg = dossier.etat ? DOSSIER_ETAT_CONFIG[dossier.etat] : null;

  return (
    <Link
      href={`/dossiers/${dossier.uid}`}
      className="block rounded-lg border bg-card p-4 transition-all hover:border-primary hover:shadow-md"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {badge}
            {dossier.chambre && (
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  dossier.chambre === 'senat' ? 'badge-senat' : 'badge-assemblee'
                }`}
              >
                {dossier.chambre === 'senat' ? 'Sénat' : 'AN'}
              </span>
            )}
            {etatCfg && (
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${etatCfg.color}`}>
                {etatCfg.label}
              </span>
            )}
            {dossier.procedureLibelle && (
              <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {dossier.procedureLibelle}
              </span>
            )}
          </div>

          <h3 className="mb-2 text-lg font-semibold leading-tight line-clamp-2">
            {formatDossierTitre(dossier.titre, dossier.procedureLibelle)}
          </h3>

          {/* Chaque contexte affiche ce qu'il sait : la liste générale connaît la
              date du dernier vote, la page d'une commission la date de dépôt. */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {dossier.lastScrutinDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Dernier vote : {formatDate(dossier.lastScrutinDate)}
              </span>
            )}
            {!dossier.lastScrutinDate && dossier.dateDepot && (
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Déposé le {formatDate(dossier.dateDepot)}
              </span>
            )}
            {typeof dossier.nbScrutins === 'number' && dossier.nbScrutins > 0 && (
              <span className="flex items-center gap-1">
                <Vote className="h-4 w-4" />
                {dossier.nbScrutins} scrutin{dossier.nbScrutins > 1 ? 's' : ''}
              </span>
            )}
            {typeof dossier.nbAmendements === 'number' && dossier.nbAmendements > 0 && (
              <span className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                {dossier.nbAmendements} amendement{dossier.nbAmendements > 1 ? 's' : ''}
              </span>
            )}
            {dossier.loiNumero && (
              <span className="font-medium text-green-700">Loi n&deg;{dossier.loiNumero}</span>
            )}
          </div>
        </div>

        <div className="flex items-center">
          <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </div>
      </div>
    </Link>
  );
}
