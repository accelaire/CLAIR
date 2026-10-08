'use client';

import Link from 'next/link';
import {
  ArrowRight, Calendar, CheckCircle, XCircle, ExternalLink,
} from 'lucide-react';
import { DidacticielTooltip } from '@/components/ui/didacticiel-tooltip';

interface ScrutinSidebarProps {
  chambre: string;
  date: string;
  /**
   * Le passage de ce vote dans la page de sa séance, seulement quand cette
   * page existe chez nous : sinon la date reste du texte.
   */
  seanceHref?: string | null;
  typeVote: string;
  sort: string;
  tags: string[];
  demandeurTexte: string | null;
  sourceUrl: string | null;
  importance: number;
  formatDemandeurs: (text: string) => React.ReactNode;
}

const chambreLabels: Record<string, string> = {
  assemblee: 'Assemblée nationale',
  senat: 'Sénat',
};

const typeVoteLabels: Record<string, string> = {
  solennel: 'Vote solennel',
  ordinaire: 'Vote ordinaire',
  motion: 'Motion',
};

export function ScrutinSidebar({
  chambre,
  date,
  seanceHref,
  typeVote,
  sort,
  tags,
  demandeurTexte,
  sourceUrl,
  importance,
  formatDemandeurs,
}: ScrutinSidebarProps) {
  const isAdopted = sort === 'adopte';

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-5">
      {/* Date */}
      <div>
        {/* La date mène à la séance, à l'endroit du vote : c'est là qu'on lit
            ce qui a été dit avant lui, et les autres votes de la journée. Une
            date en bleu ne disait pas où elle menait : l'intitulé nomme la
            séance, et une ligne dit ce qu'on y trouve. */}
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
          {seanceHref
            ? (chambre === 'senat' ? 'Journée de séance' : 'Séance publique')
            : 'Date du scrutin'}
        </h3>
        {seanceHref ? (
          <Link href={seanceHref} className="group flex items-start gap-1.5 text-sm text-primary">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0">
              <span className="group-hover:underline">{formatDate(date)}</span>
              <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary">
                Voir ce vote dans la séance
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </span>
          </Link>
        ) : (
          <p className="text-sm flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            {formatDate(date)}
          </p>
        )}
      </div>

      {/* Chambre */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Chambre</h3>
        <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-md ${
          chambre === 'senat' ? 'badge-senat' : 'badge-assemblee'
        }`}>
          {chambreLabels[chambre]}
        </span>
      </div>

      {/* Demandeur */}
      {demandeurTexte && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Vote demandé par</h3>
          <p className="text-sm">{formatDemandeurs(demandeurTexte)}</p>
        </div>
      )}

      {/* Type de vote */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
          Type de vote
          <DidacticielTooltip
            content="Vote solennel : sur l'ensemble d'un texte. Ordinaire : sur un article ou amendement. Motion : procédure spécifique (censure, rejet...)."
            learnMoreHref="/comprendre/scrutin"
          />
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm">{typeVoteLabels[typeVote] || typeVote}</span>
          {importance >= 4 && (
            <span className="px-2 py-0.5 text-xs font-medium badge-important rounded">
              Important
            </span>
          )}
        </div>
      </div>

      {/* Résultat du vote */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
          Résultat du vote
          <DidacticielTooltip
            content="Adopté si les « pour » dépassent les « contre ». Abstentions et absences ne comptent pas dans les suffrages exprimés."
            learnMoreHref="/comprendre/scrutin"
          />
        </h3>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
          isAdopted ? 'badge-adopte' : 'badge-rejete'
        }`}>
          {isAdopted ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {isAdopted ? 'Adopté' : 'Rejeté'}
        </span>
      </div>

      {/* Thématiques */}
      {tags && tags.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Thématiques</h3>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <Link
                key={t}
                href={`/scrutins?tag=${encodeURIComponent(t)}`}
                className="px-2.5 py-1 bg-primary/10 text-primary rounded-md text-xs hover:bg-primary/20 transition-colors"
              >
                {t}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Le dossier législatif est présenté en bandeau au-dessus de la page
          (cf. ScrutinDossierBanner), pas ici : c'est une destination, pas une
          métadonnée du scrutin. */}

      {/* Lien source */}
      {sourceUrl && (
        <div>
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            Voir sur {chambre === 'senat' ? 'senat.fr' : 'assemblee-nationale.fr'}
          </a>
        </div>
      )}
    </div>
  );
}
