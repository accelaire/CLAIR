import { CheckCircle2, CircleDashed, Clock, Contrast, Hourglass } from 'lucide-react';
import type { ResultatsNationaux, StatutCirconscription } from '@/lib/senatoriales/resultats';

/**
 * Bandeau des pages d'aperçu. Il disparaît le jour où ces pages deviennent
 * publiques : il suffit alors de ne plus le rendre.
 */
export function BandeauApercu() {
  return (
    <div className="border-b border-amber-300/60 bg-amber-50 px-4 py-1.5 text-center text-xs font-medium text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
      Aperçu non public de la page de résultats : ni indexé, ni lié depuis le site
    </div>
  );
}

const BADGE = 'inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 font-medium text-foreground';

/** État de la soirée à l'échelle nationale. */
export function BadgeEtat({
  compteurs,
  maintenant,
}: {
  compteurs: ResultatsNationaux['compteurs'];
  maintenant: string;
}) {
  const icone = 'h-3.5 w-3.5';
  if (compteurs.pourvue === compteurs.circonscriptions) {
    return (
      <span className={BADGE}>
        <CheckCircle2 className={icone} aria-hidden /> Résultats connus
      </span>
    );
  }
  if (compteurs.pourvue + compteurs.partielle + compteurs.second_tour > 0) {
    return (
      <span className={BADGE}>
        <Contrast className={icone} aria-hidden /> Résultats partiels
      </span>
    );
  }
  // Wallis-et-Futuna ouvre ses bureaux le samedi à 22h30, heure de Paris.
  if (new Date(maintenant) < new Date('2026-09-26T22:30:00+02:00')) {
    return (
      <span className={BADGE}>
        <CircleDashed className={icone} aria-hidden /> Scrutin dimanche 27 septembre
      </span>
    );
  }
  return (
    <span className={BADGE}>
      <Clock className={icone} aria-hidden /> Vote en cours
    </span>
  );
}

/** État d'une circonscription, en badge d'en-tête. */
export function BadgeCirconscription({ statut }: { statut: StatutCirconscription }) {
  const icone = 'h-3.5 w-3.5';
  switch (statut) {
    case 'pourvue':
      return (
        <span className={BADGE}>
          <CheckCircle2 className={icone} aria-hidden /> Résultats connus
        </span>
      );
    case 'partielle':
    case 'second_tour':
      return (
        <span className={BADGE}>
          <Contrast className={icone} aria-hidden /> 1er tour connu
        </span>
      );
    case 'resultats_attendus':
      return (
        <span className={BADGE}>
          <Hourglass className={icone} aria-hidden /> Résultats attendus
        </span>
      );
    case 'vote_en_cours':
      return (
        <span className={BADGE}>
          <Clock className={icone} aria-hidden /> Vote en cours
        </span>
      );
    default:
      return (
        <span className={BADGE}>
          <CircleDashed className={icone} aria-hidden /> Scrutin dimanche 27 septembre
        </span>
      );
  }
}
