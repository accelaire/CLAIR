'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, FileText, Vote } from 'lucide-react';
import { AmendementSortBadge } from '@/components/AmendementSortBadge';
import { scrutinHref } from '@/lib/scrutin-url';

interface AmendementData {
  id: string;
  numero: string;
  articleVise?: string | null;
  auteurLibelle?: string | null;
  exposeSommaire?: string | null;
  dispositif?: string | null;
  sort?: string | null;
  dateDepot?: string | null;
  texteRef?: string | null;
  scrutins?: Array<{ id: string; numero: string | number; chambre?: string; session?: string; sort?: string; date?: string }>;
  dossier?: { uid: string; titre?: string | null; titreCourt?: string | null } | null;
}

interface ExpandableAmendementCardProps {
  amendement: AmendementData;
  showAuteur?: boolean;
}

const stripHtml = (html: string) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\r\n/g, '\n')
    .trim();

export function ExpandableAmendementCard({ amendement, showAuteur }: ExpandableAmendementCardProps) {
  const [expanded, setExpanded] = useState(false);

  const exposeSommaireText = amendement.exposeSommaire ? stripHtml(amendement.exposeSommaire) : null;
  const dispositifText = amendement.dispositif ? stripHtml(amendement.dispositif) : null;
  const hasLongContent = (exposeSommaireText && exposeSommaireText.length > 200) || !!dispositifText;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-sm font-medium">n&deg;{amendement.numero}</span>
            {amendement.articleVise && (
              <span className="text-sm text-muted-foreground">&bull; {amendement.articleVise}</span>
            )}
          </div>
          {showAuteur && amendement.auteurLibelle && (
            <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{amendement.auteurLibelle}</p>
          )}
          {exposeSommaireText && (
            <div className="mb-2">
              <p className={`text-sm leading-relaxed ${!expanded ? 'line-clamp-3' : ''}`}>
                {exposeSommaireText}
              </p>
            </div>
          )}
          {expanded && dispositifText && (
            <div className="mt-3 rounded bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Dispositif :</p>
              <p className="text-sm leading-relaxed whitespace-pre-line">{dispositifText}</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-2">
            {amendement.dateDepot && (
              <span>Déposé le {formatDate(amendement.dateDepot)}</span>
            )}
            {amendement.texteRef && (
              <>
                <span>&bull;</span>
                <span className="font-mono">{amendement.texteRef}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <AmendementSortBadge sort={amendement.sort ?? null} />
          {amendement.scrutins && amendement.scrutins.length > 0 && (
            <div className="flex flex-col items-end gap-1">
              {amendement.scrutins.map((s) => (
                <Link
                  key={s.id}
                  href={scrutinHref(s)}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline w-fit"
                >
                  <span className="hidden sm:inline">Voir le vote n&deg;{s.numero}</span>
                  <span className="sm:hidden">Vote n&deg;{s.numero}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              ))}
            </div>
          )}
          {amendement.dossier && (
            <Link
              href={`/dossiers/${amendement.dossier.uid}`}
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline w-fit max-w-[200px]"
            >
              <FileText className="h-3 w-3 flex-shrink-0" />
              <span className="line-clamp-1">
                {amendement.dossier.titreCourt || amendement.dossier.titre || amendement.dossier.uid}
              </span>
            </Link>
          )}
        </div>
      </div>

      {hasLongContent && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Réduire
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Voir plus
            </>
          )}
        </button>
      )}
    </div>
  );
}