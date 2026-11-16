import { Minus, ThumbsDown, ThumbsUp } from 'lucide-react';

export const POSITIONS_VOTE: Record<string, { label: string; className: string; barre: string; icon: typeof Minus }> = {
  pour: {
    label: 'Pour',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    barre: 'bg-green-500',
    icon: ThumbsUp,
  },
  contre: {
    label: 'Contre',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    barre: 'bg-red-500',
    icon: ThumbsDown,
  },
  abstention: {
    label: 'Abstention',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    barre: 'bg-yellow-400',
    icon: Minus,
  },
  absent: {
    label: 'Absent',
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400',
    barre: 'bg-slate-400',
    icon: Minus,
  },
};

/** La position d'un parlementaire à un scrutin : Pour, Contre, Abstention, Absent. */
export function VotePositionBadge({ position }: { position: string }) {
  const config = POSITIONS_VOTE[position] ?? {
    label: position,
    className: 'bg-muted text-muted-foreground',
    icon: Minus,
  };
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}
