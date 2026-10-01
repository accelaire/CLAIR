import { CheckCircle2, CircleDashed, Clock, Contrast, Hourglass } from 'lucide-react';
import { couleurFamille, libelleFamille } from '@/lib/senatoriales/familles';
import {
  libelleStatut,
  type EtapeSecondTour,
  type StatutCirconscription,
} from '@/lib/senatoriales/resultats';

/** Pictogramme et libellé de l'état d'une circonscription. */
export function PastilleEtat({
  statut,
  secondTour,
  className = '',
}: {
  statut: StatutCirconscription;
  secondTour: EtapeSecondTour | null;
  className?: string;
}) {
  const icone = 'h-3.5 w-3.5 shrink-0';
  const picto = {
    pas_ouvert: <CircleDashed className={icone} aria-hidden />,
    vote_en_cours: <Clock className={icone} aria-hidden />,
    resultats_attendus: <Hourglass className={icone} aria-hidden />,
    second_tour: (
      <span
        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-current text-[9px] font-bold leading-none"
        aria-hidden
      >
        2
      </span>
    ),
    partielle: <Contrast className={icone} aria-hidden />,
    pourvue: <CheckCircle2 className={icone} aria-hidden />,
  }[statut];

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {picto}
      {libelleStatut(statut, secondTour)}
    </span>
  );
}

/**
 * Un point par siège : plein et coloré par la famille de l'élu, vide tant que
 * le siège n'est pas attribué.
 */
export function PointsSieges({
  sieges,
  taille = 'h-2.5 w-2.5',
}: {
  sieges: ({ famille: string | null; nuance: string | null } | null)[];
  taille?: string;
}) {
  return (
    <span className="inline-flex max-w-[5.5rem] flex-wrap justify-end gap-1">
      {sieges.map((siege, i) =>
        siege ? (
          <span
            key={i}
            className={`${taille} rounded-full`}
            style={{ backgroundColor: couleurFamille(siege.famille) }}
            title={`${libelleFamille(siege.famille)}${siege.nuance ? ` (${siege.nuance})` : ''}`}
          />
        ) : (
          <span key={i} className={`${taille} rounded-full border border-muted-foreground/60`} title="Siège non attribué" />
        ),
      )}
    </span>
  );
}
