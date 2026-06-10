import { Scale, ExternalLink } from 'lucide-react';

interface LoiPromulgueeCardProps {
  loiNumero: string | null;
  loiTitre?: string | null;
  loiDateJO?: string | null;
  urlLegifrance?: string | null;
  urlJournalOfficiel?: string | null;
  /** Classe sur le conteneur (ex. marges selon le contexte d'usage). */
  className?: string;
}

const formatDateJO = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Carte "Loi promulguée" partagée entre la page Sujet et la page Dossier.
 * Le numéro de loi pointe vers le texte sur Légifrance ; un lien distinct
 * renvoie vers l'édition du Journal officiel quand elle est disponible.
 */
export function LoiPromulgueeCard({
  loiNumero,
  loiTitre,
  loiDateJO,
  urlLegifrance,
  urlJournalOfficiel,
  className = '',
}: LoiPromulgueeCardProps) {
  if (!loiNumero) return null;

  return (
    <div className={`p-4 rounded-lg border border-green-500/30 bg-green-500/5 dark:bg-green-500/10 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-green-500/15 flex-shrink-0">
          <Scale className="h-5 w-5 text-green-500" />
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
          <span className="block text-xs font-medium text-green-500 uppercase tracking-wide mb-0.5">Loi promulguée</span>
          {urlLegifrance ? (
            <a
              href={urlLegifrance}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-green-700 dark:text-green-400 hover:underline inline-flex items-center gap-1.5"
            >
              Loi n°{loiNumero}
              <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
            </a>
          ) : (
            <p className="font-semibold">Loi n°{loiNumero}</p>
          )}
          {loiTitre && <p className="text-sm text-muted-foreground">{loiTitre}</p>}
          {loiDateJO && (
            <p className="text-xs text-muted-foreground mt-1">
              Publiée au Journal officiel le {formatDateJO(loiDateJO)}
            </p>
          )}
          </div>
          {(urlLegifrance || urlJournalOfficiel) && (
            <div className="flex flex-wrap gap-2 sm:flex-shrink-0">
              {urlLegifrance && (
                <a
                  href={urlLegifrance}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Texte de loi
                </a>
              )}
              {urlJournalOfficiel && (
                <a
                  href={urlJournalOfficiel}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 dark:text-green-400 border border-green-600/40 hover:bg-green-600/10 rounded-md transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Journal officiel
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
