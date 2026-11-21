'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, ChevronUp, FileText, Vote } from 'lucide-react';
import { AmendementSortBadge } from '@/components/AmendementSortBadge';
import { DiscussionsEtSousAmendements, SousAmendementDe } from '@/components/AmendementSeance';
import { ContenuAmendement, contenuAmendementDepasse } from '@/components/ContenuAmendement';
import { amendementHref, ancreAmendement, libelleAlinea, type MetadonneesAmendement } from '@/lib/amendements';
import { dossierTitreCourtLisible } from '@/lib/dossiers';
import { scrutinHref } from '@/lib/scrutin-url';
import type { RenvoiDroit } from '@/lib/texte-amendement';

interface AmendementData extends MetadonneesAmendement {
  id: string;
  uid?: string;
  numero: string;
  articleVise?: string | null;
  auteurLibelle?: string | null;
  exposeSommaire?: string | null;
  dispositif?: string | null;
  /** Liens Légifrance du dispositif. */
  renvois?: RenvoiDroit[];
  /** Liens Légifrance de l'exposé sommaire. */
  renvoisExpose?: RenvoiDroit[];
  sort?: string | null;
  dateDepot?: string | null;
  texteRef?: string | null;
  scrutins?: Array<{ id: string; numero: string | number; chambre?: string; session?: string; sort?: string; date?: string }>;
  dossier?: { uid: string; titre?: string | null; titreCourt?: string | null } | null;
}

interface ExpandableAmendementCardProps {
  amendement: AmendementData;
  showAuteur?: boolean;
  /** Le dossier de la page, pour déplier sous-amendements et discussions. */
  dossierUid?: string;
  /** L'amendement visé par le lien qui a ouvert la page : mis en évidence. */
  surligne?: boolean;
}

/**
 * Carte d'un amendement (fiche d'un parlementaire, page d'un dossier).
 *
 * Une seule colonne : à côté du texte, la colonne des liens (vote, dossier)
 * ne laissait au texte que la moitié d'un écran de téléphone.
 */
export function ExpandableAmendementCard({ amendement, showAuteur, dossierUid, surligne }: ExpandableAmendementCardProps) {
  const [expanded, setExpanded] = useState(false);
  const alinea = libelleAlinea(amendement);
  const dossierDeLAmendement = dossierUid ?? amendement.dossier?.uid;
  const visee = [amendement.articleVise, alinea].filter(Boolean).join(', ');
  const depasse = contenuAmendementDepasse(amendement.dispositif, amendement.exposeSommaire);
  // Sur la page du dossier, le lien vers ce même dossier n'apprend rien.
  const dossierLie = amendement.dossier && amendement.dossier.uid !== dossierUid ? amendement.dossier : null;
  const scrutins = amendement.scrutins ?? [];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div
      id={amendement.uid ? ancreAmendement(amendement.uid) : undefined}
      className={`scroll-mt-20 rounded-lg border p-4 transition-colors ${
        surligne ? 'border-primary/20 bg-primary/5' : 'bg-card'
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm">
          <span className="font-mono font-medium">n&deg;{amendement.numero}</span>
          {visee && <span className="text-muted-foreground"> &bull; {visee}</span>}
        </p>
        <div className="flex-shrink-0">
          <AmendementSortBadge sort={amendement.sort ?? null} />
        </div>
      </div>

      <SousAmendementDe amendement={amendement} dossierUid={dossierDeLAmendement} />
      {showAuteur && amendement.auteurLibelle && (
        <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{amendement.auteurLibelle}</p>
      )}

      <ContenuAmendement
        dispositif={amendement.dispositif}
        renvois={amendement.renvois}
        exposeSommaire={amendement.exposeSommaire}
        renvoisExpose={amendement.renvoisExpose}
        replie={!expanded}
      />
      {depasse && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Réduire
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Lire en entier
            </>
          )}
        </button>
      )}

      {(scrutins.length > 0 || dossierLie) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
          {scrutins.map((s) => (
            <Link
              key={s.id}
              href={scrutinHref(s)}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <Vote className="h-3.5 w-3.5" />
              Voir le vote n&deg;{s.numero}
              <ChevronRight className="h-3 w-3" />
            </Link>
          ))}
          {dossierLie && (
            <Link
              href={
                amendement.uid
                  ? amendementHref(dossierLie.uid, amendement.uid)
                  : `/dossiers/${dossierLie.uid}`
              }
              className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-muted-foreground hover:text-primary hover:underline"
            >
              <FileText className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">
                {dossierTitreCourtLisible(dossierLie.titreCourt) || dossierLie.titre || dossierLie.uid}
              </span>
            </Link>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        {amendement.dateDepot && <span>Déposé le {formatDate(amendement.dateDepot)}</span>}
        {/* Référence technique du texte amendé : utile aux réutilisateurs,
            du bruit sur un écran de téléphone. */}
        {amendement.texteRef && (
          <span className="hidden sm:inline">
            {amendement.dateDepot && <>&bull; </>}
            <span className="font-mono">{amendement.texteRef}</span>
          </span>
        )}
      </div>

      <DiscussionsEtSousAmendements amendement={amendement} dossierUid={dossierDeLAmendement} />
    </div>
  );
}
