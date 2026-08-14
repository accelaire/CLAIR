'use client';

import { Vote, DoorOpen, PauseCircle, Coins, Landmark, ExternalLink } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface AgendaEvenement {
  id: string;
  slug: string;
  type: 'election' | 'session' | 'suspension' | 'budget' | 'institution';
  titre: string;
  description: string | null;
  dateDebut: string;
  dateFin: string | null;
  /** false = date non encore fixée par décret : on n'affiche QUE le mois. */
  datePrecise: boolean;
  chambre: 'assemblee' | 'senat' | null;
  /** `[{ label, url? }]` — plusieurs quand le repère vaut pour les deux chambres. */
  sources: Array<{ label: string; url?: string }> | null;
  important: boolean;
}

interface TypeMeta {
  label: string;
  icon: LucideIcon;
  /** Carte : fond + texte + bordure. */
  card: string;
  /** Pastille du calendrier. */
  dot: string;
}

export const TYPE_EVENEMENT_META: Record<AgendaEvenement['type'], TypeMeta> = {
  election: {
    label: 'Élection',
    icon: Vote,
    card: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900',
    dot: 'bg-rose-500',
  },
  session: {
    label: 'Session',
    icon: DoorOpen,
    card: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900',
    dot: 'bg-emerald-500',
  },
  suspension: {
    label: 'Suspension',
    icon: PauseCircle,
    card: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
  },
  budget: {
    label: 'Budget',
    icon: Coins,
    card: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900',
    dot: 'bg-amber-500',
  },
  institution: {
    label: 'Institution',
    icon: Landmark,
    card: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-900',
    dot: 'bg-violet-500',
  },
};

const MONTH_NAMES = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/**
 * Clé de jour d'un instant ISO. On tranche la chaîne au lieu de passer par
 * `Date`, parce que les dates d'événement sont stockées à minuit UTC : les
 * relire en heure locale décalerait le jour d'un cran à l'ouest de Greenwich.
 */
export function jourDe(iso: string): string {
  return iso.slice(0, 10);
}

/** Tous les jours couverts par un événement, bornes incluses. */
export function joursCouverts(evenement: AgendaEvenement): string[] {
  const debut = jourDe(evenement.dateDebut);
  if (!evenement.dateFin) return [debut];

  const fin = jourDe(evenement.dateFin);
  const jours: string[] = [];
  const curseur = new Date(`${debut}T12:00:00Z`);
  const borne = new Date(`${fin}T12:00:00Z`);

  while (curseur <= borne) {
    jours.push(curseur.toISOString().slice(0, 10));
    curseur.setUTCDate(curseur.getUTCDate() + 1);
  }
  return jours;
}

function formatJour(iso: string): string {
  const [annee, mois, jour] = jourDe(iso).split('-').map(Number);
  return `${jour} ${MONTH_NAMES[(mois ?? 1) - 1]} ${annee}`;
}

function formatMois(iso: string): string {
  const [annee, mois] = jourDe(iso).split('-').map(Number);
  return `${MONTH_NAMES[(mois ?? 1) - 1]} ${annee}`;
}

/**
 * Libellé de date. Une échéance dont le décret de convocation n'est pas paru
 * n'affiche QUE son mois : le jour stocké ne sert qu'au tri et le présenter
 * reviendrait à inventer une information.
 */
export function formatDateEvenement(evenement: AgendaEvenement): string {
  if (!evenement.datePrecise) return `Courant ${formatMois(evenement.dateDebut)}`;
  if (!evenement.dateFin) return formatJour(evenement.dateDebut);
  return `Du ${formatJour(evenement.dateDebut)} au ${formatJour(evenement.dateFin)}`;
}

const CHAMBRE_LABEL: Record<string, string> = {
  assemblee: 'Assemblée nationale',
  senat: 'Sénat',
};

export function EvenementCard({ evenement }: { evenement: AgendaEvenement }) {
  const meta = TYPE_EVENEMENT_META[evenement.type];
  const Icon = meta.icon;

  return (
    <article className={`rounded-lg border p-4 ${meta.card}`}>
      <div className='flex items-start gap-3'>
        <Icon className='h-5 w-5 shrink-0 mt-0.5' aria-hidden />
        <div className='min-w-0 flex-1'>
          <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
            <h4 className='font-semibold leading-tight'>{evenement.titre}</h4>
            {evenement.chambre && (
              <span className='rounded border border-current/30 px-1.5 py-0.5 text-[11px] font-medium opacity-80'>
                {CHAMBRE_LABEL[evenement.chambre]}
              </span>
            )}
          </div>

          <p className='mt-0.5 text-sm font-medium opacity-90'>
            {formatDateEvenement(evenement)}
            {!evenement.datePrecise && (
              <span className='ml-1.5 font-normal opacity-75'>(date non encore fixée)</span>
            )}
          </p>

          {evenement.description && (
            <p className='mt-2 text-sm leading-relaxed opacity-90'>{evenement.description}</p>
          )}

          {evenement.sources && evenement.sources.length > 0 && (
            <p className='mt-2 text-xs opacity-75'>
              <span>{evenement.sources.length > 1 ? 'Sources' : 'Source'} : </span>
              {evenement.sources.map((s, i) => (
                <span key={s.label}>
                  {i > 0 && <span aria-hidden> · </span>}
                  {s.url ? (
                    <a
                      href={s.url}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='inline-flex items-center gap-1 underline underline-offset-2 hover:no-underline'
                    >
                      {s.label}
                      <ExternalLink className='h-3 w-3' aria-hidden />
                    </a>
                  ) : (
                    s.label
                  )}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
