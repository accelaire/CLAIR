// =============================================================================
// La carte d'une pétition
// =============================================================================
//
// Partagée par la liste `/petitions` et l'onglet « Pétitions » d'une
// commission, sur le modèle de `DossierCard` : un seul balisage, pour que les
// deux ne divergent pas.
//
// Ce que la carte montre : la collecte (ouverte ou close) et la dernière étape
// du parcours, jamais le statut brut de la plateforme, qui vaut « ouverte » par
// défaut à la source.
// =============================================================================

import Link from 'next/link';
import { CalendarDays, PenLine } from 'lucide-react';
import {
  COULEUR_ETAPE,
  cheminPetition,
  dateLongue,
  estAVenir,
  libelleEtape,
  signaturesEnClair,
  type PetitionResume,
} from '@/lib/petitions';

export function PetitionCard({
  petition,
  avecCommission = true,
}: {
  petition: PetitionResume;
  /** Inutile dans l'onglet d'une commission, où elle est la même pour toutes. */
  avecCommission?: boolean;
}) {
  const p = petition;
  const aVenir = estAVenir(p.etapeDate);

  return (
    <Link
      href={cheminPetition(p)}
      className="block rounded-lg border bg-card p-4 transition-all hover:border-primary hover:shadow-md"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${p.chambre === 'senat' ? 'badge-senat' : 'badge-assemblee'}`}>
          {p.chambre === 'senat' ? 'Sénat' : 'AN'}
        </span>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            p.collecte === 'ouverte'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {p.collecte === 'ouverte' ? 'Signatures ouvertes' : 'Collecte close'}
        </span>
        {p.etape && (
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${COULEUR_ETAPE[p.etape]}`}>
            {libelleEtape(p.etape, p.etapeDate)}
            {p.etapeDate && ` ${aVenir ? 'le' : '·'} ${dateLongue(p.etapeDate)}`}
          </span>
        )}
      </div>

      <h3 className="font-semibold leading-snug">{p.titre}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.extrait}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 font-medium text-foreground">
          <PenLine className="h-3.5 w-3.5" aria-hidden />
          {signaturesEnClair(p.signatures)}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
          Publiée le {dateLongue(p.datePublication)}
        </span>
        <span>n° {p.numero}</span>
        {avecCommission && p.commission && <span className="truncate">{p.commission.nom}</span>}
        {p.typeSource && <span>{p.typeSource}</span>}
      </div>
    </Link>
  );
}
