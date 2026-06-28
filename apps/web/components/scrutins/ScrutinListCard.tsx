import Link from 'next/link';
import { CheckCircle, XCircle, Calendar, Tag } from 'lucide-react';
import { scrutinHref } from '@/lib/scrutin-url';

export interface ScrutinListItem {
  id: string;
  numero: number;
  chambre: string;
  session?: string | null;
  date: string;
  titre: string;
  sort: string;
  typeVote: string;
  nombrePour: number;
  nombreContre: number;
  nombreAbstention: number;
  importance: number;
  tags: string[];
}

const sortLabels: Record<string, { label: string; color: string }> = {
  adopte: { label: 'Adopté', color: 'badge-adopte' },
  rejete: { label: 'Rejeté', color: 'badge-rejete' },
};

const chambreLabels: Record<string, string> = {
  assemblee: 'Assemblée nationale',
  senat: 'Sénat',
};

const typeLabels: Record<string, string> = {
  solennel: 'Solennel',
  ordinaire: 'Ordinaire',
  motion: 'Motion',
};

const capitalize = (s: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const formatSenatSession = (session: string): string => {
  const year = parseInt(session, 10);
  return Number.isNaN(year) ? session : `${year}-${year + 1}`;
};

export function ScrutinListCard({ scrutin }: { scrutin: ScrutinListItem }) {
  const href = scrutinHref(scrutin);

  return (
    <Link
      href={href}
      className="block rounded-lg border bg-card p-4 transition-all hover:border-primary hover:shadow-md"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">
              Scrutin n°{scrutin.numero}
            </span>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded ${
                scrutin.chambre === 'senat' ? 'badge-senat' : 'badge-assemblee'
              }`}
            >
              {chambreLabels[scrutin.chambre] || 'Assemblée nationale'}
            </span>
            {scrutin.chambre === 'senat' && scrutin.session && (
              <span className="px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground rounded">
                {formatSenatSession(scrutin.session)}
              </span>
            )}
            {scrutin.importance >= 4 && (
              <span className="px-2 py-0.5 text-xs font-medium badge-important rounded">
                Important
              </span>
            )}
          </div>
          <h3 className="font-semibold text-lg leading-tight mb-2 line-clamp-2">
            {scrutin.titre}
          </h3>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatDate(scrutin.date)}
            </span>
            <span className="px-2 py-0.5 bg-muted rounded text-xs">
              {typeLabels[scrutin.typeVote] || scrutin.typeVote}
            </span>
            {scrutin.tags && scrutin.tags.length > 0 && (
              <span className="flex items-center gap-1 flex-wrap">
                <Tag className="h-3 w-3" />
                {scrutin.tags.slice(0, 3).map((tag, idx) => (
                  <span key={tag}>
                    {capitalize(tag)}
                    {idx < Math.min(scrutin.tags.length, 3) - 1 && ','}
                  </span>
                ))}
                {scrutin.tags.length > 3 && ` +${scrutin.tags.length - 3}`}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1 text-adopte">
              <CheckCircle className="h-4 w-4" />
              {scrutin.nombrePour}
            </span>
            <span className="flex items-center gap-1 text-rejete">
              <XCircle className="h-4 w-4" />
              {scrutin.nombreContre}
            </span>
            <span className="text-muted-foreground">
              {scrutin.nombreAbstention} abs.
            </span>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${
              sortLabels[scrutin.sort]?.color ||
              'bg-muted text-muted-foreground'
            }`}
          >
            {scrutin.sort === 'adopte' && <CheckCircle className="h-4 w-4" />}
            {scrutin.sort === 'rejete' && <XCircle className="h-4 w-4" />}
            {sortLabels[scrutin.sort]?.label || scrutin.sort}
          </span>
        </div>
      </div>
    </Link>
  );
}
