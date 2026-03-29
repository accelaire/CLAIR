'use client';

import Link from 'next/link';
import {
  Calendar, CheckCircle, XCircle, ExternalLink,
} from 'lucide-react';
import { DidacticielTooltip } from '@/components/ui/didacticiel-tooltip';
import { getDossierEtat } from '@/lib/dossiers';

interface DossierLegislatif {
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

interface ScrutinSidebarProps {
  chambre: string;
  date: string;
  typeVote: string;
  sort: string;
  tags: string[];
  demandeurTexte: string | null;
  dossier: DossierLegislatif | null;
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

const formatDossierTitre = (titre: string, procedureLibelle?: string | null): string => {
  const firstChar = titre.charAt(0);
  if (firstChar !== firstChar.toUpperCase() && procedureLibelle) {
    return `${procedureLibelle} ${titre}`;
  }
  return titre;
};

export function ScrutinSidebar({
  chambre,
  date,
  typeVote,
  sort,
  tags,
  demandeurTexte,
  dossier,
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
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Date du scrutin</h3>
        <p className="text-sm flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          {formatDate(date)}
        </p>
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

      {/* Dossier législatif */}
      {dossier && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Dossier législatif</h3>
          <div className="rounded-lg border p-3 space-y-2">
            <Link
              href={`/dossiers/${dossier.uid}`}
              className="text-sm font-medium hover:text-primary hover:underline block line-clamp-2"
            >
              {formatDossierTitre(dossier.titre, dossier.procedureLibelle)}
            </Link>
            {(() => {
              const etatInfo = getDossierEtat(dossier.etat);
              return etatInfo ? (
                <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${etatInfo.color}`}>
                  {etatInfo.label}
                </span>
              ) : null;
            })()}
            {dossier.loiNumero && (
              <p className="text-xs text-green-700 font-medium">
                Loi n°{dossier.loiNumero}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {dossier.urlAN && (
                <a
                  href={dossier.urlAN}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  AN
                </a>
              )}
              {dossier.urlSenat && (
                <a
                  href={dossier.urlSenat}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Sénat
                </a>
              )}
              {dossier.urlLegifrance && (
                <a
                  href={dossier.urlLegifrance}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Légifrance
                </a>
              )}
            </div>
          </div>
        </div>
      )}

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
