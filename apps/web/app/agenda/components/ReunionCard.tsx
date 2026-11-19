'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { MapPin, Video, FileText, ChevronDown, Users, Vote } from 'lucide-react';
import { ScrutinsByDossier } from '@/components/scrutins/ScrutinsByDossier';
import { deriveChambre } from '@/lib/chambre';
import { urlDuCompteRendu } from '@/lib/compte-rendu-url';
import {
  estAnnulee,
  estSeance,
  horaireDeLaReunion,
  natureDeReunion,
  pointsDeLOrdreDuJour,
  titreDeReunion,
} from '@/lib/agenda';
import { BadgeEnDirect } from './BadgeEnDirect';

export interface AgendaReunion {
  id: string;
  uid: string;
  type: string;
  dateDebut: string;
  dateFin: string | null;
  lieu: string | null;
  etat: string | null;
  odjResume: string | null;
  captationVideo: boolean | null;
  compteRenduRef: string | null;
  urlVideo: string | null;
  commission: {
    id: string;
    slug: string;
    nom: string;
    nomCourt: string | null;
    chambre: string;
    type: string;
    organeRef: string | null;
  } | null;
  nbParticipants: number;
  scrutins?: Array<{
    id: string;
    numero: number;
    titre: string;
    sort: string;
    chambre: string;
    session?: string;
    nombrePour: number;
    nombreContre: number;
    nombreAbstention: number;
    dossier: { id: string; uid: string; titre: string; titreCourt: string | null; procedureLibelle?: string | null } | null;
  }>;
}

const CHAMBRE: Record<string, { label: string; classe: string }> = {
  assemblee: { label: 'AN', classe: 'badge-assemblee' },
  senat: { label: 'Sénat', classe: 'badge-senat' },
};

const STORAGE_KEY = 'agenda-expanded';

/** Ce qui a été déplié reste déplié au retour arrière, le temps de la session. */
function useDepliee(id: string): [boolean, (v: boolean) => void] {
  const [depliee, setDeplieeBrut] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as string[]).includes(id) : false;
    } catch {
      return false;
    }
  });
  const setDepliee = useCallback(
    (val: boolean) => {
      setDeplieeBrut(val);
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        const ids = new Set<string>(stored ? JSON.parse(stored) : []);
        if (val) ids.add(id);
        else ids.delete(id);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
      } catch {
        /* stockage indisponible : l'état reste local */
      }
    },
    [id],
  );
  return [depliee, setDepliee];
}

const PASTILLE_LIEN =
  'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors';

export function ReunionCard({
  reunion,
  liveUrl,
  statut = 'normale',
  rang,
  depuisHier = false,
}: {
  reunion: AgendaReunion;
  /** Le lien du direct, quand `directsDesReunions` tient la réunion pour en direct. */
  liveUrl?: string;
  /** `en-cours` : commencée, sans direct connu. */
  statut?: 'normale' | 'en-cours';
  /** « 2e séance », pour une séance de l'AN parmi plusieurs le même jour. */
  rang?: string;
  /** Commencée la veille et toujours en cours : son heure est celle d'hier. */
  depuisHier?: boolean;
}) {
  const [depliee, setDepliee] = useDepliee(reunion.id);
  const chambre = deriveChambre(reunion);
  const annulee = estAnnulee(reunion);
  const seance = estSeance(reunion);
  const titre = titreDeReunion(reunion);
  const nature = natureDeReunion(reunion);
  const horaire = horaireDeLaReunion(reunion);
  const points = pointsDeLOrdreDuJour(reunion.odjResume);
  const scrutins = reunion.scrutins ?? [];
  const aDeplier = points.length > 1 || (points[0]?.length ?? 0) > 160 || scrutins.length > 0;
  const enDirect = !!liveUrl && !annulee;
  const commencee = new Date(reunion.dateDebut).getTime() < Date.now();
  const urlCompteRendu = commencee && reunion.compteRenduRef ? urlDuCompteRendu(reunion.compteRenduRef) : null;

  const fond = enDirect
    ? 'border-primary/30 bg-primary/5'
    : statut === 'en-cours'
      ? 'border-primary/20 bg-card'
      : annulee
        ? 'bg-muted/40'
        : 'bg-card';

  return (
    <article
      id={`event-${reunion.id}`}
      className={`group relative scroll-mt-24 rounded-lg border p-4 transition-all hover:border-primary/40 hover:shadow-sm ${fond}`}
    >
      {/* Lien étalé : la carte mène à la page de la réunion. Ce qui est
          cliquable à l'intérieur (commission, vidéo, compte rendu, dépliage)
          passe au-dessus, en z-[2]. */}
      <Link href={`/reunions/${encodeURIComponent(reunion.uid)}`} className='absolute inset-0 z-[1] rounded-lg'>
        <span className='sr-only'>Voir le détail : {titre}</span>
      </Link>

      <div className='flex gap-4'>
        <div className='hidden w-16 shrink-0 pt-0.5 text-right sm:block'>
          <div className={`text-sm font-semibold tabular-nums ${annulee ? 'text-muted-foreground line-through' : ''}`}>
            {horaire.debut}
          </div>
          {horaire.fin && (
            <div className='text-xs tabular-nums text-muted-foreground'>{horaire.fin}</div>
          )}
        </div>

        <div className='min-w-0 flex-1'>
          <div className='flex flex-wrap items-center gap-1.5'>
            {/* Sur téléphone, l'heure passe en tête de ligne : la colonne
                prenait un quart de la largeur. */}
            <span className={`mr-0.5 text-sm font-semibold tabular-nums sm:hidden ${annulee ? 'text-muted-foreground line-through' : ''}`}>
              {horaire.debut}
              {horaire.fin && <span className='font-normal text-muted-foreground'> – {horaire.fin}</span>}
            </span>
            {chambre && CHAMBRE[chambre] && (
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${CHAMBRE[chambre]!.classe}`}>
                {CHAMBRE[chambre]!.label}
              </span>
            )}
            {/* La nature redirait le titre d'une séance : on donne son rang à la place. */}
            {seance ? (
              rang && <span className='rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground'>{rang}</span>
            ) : (
              <span className='rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground'>{nature}</span>
            )}
            {depuisHier && (
              <span className='rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground'>Depuis hier</span>
            )}
            {enDirect && (
              <span className='relative z-[2]'>
                <BadgeEnDirect href={liveUrl} />
              </span>
            )}
            {annulee && (
              <span className='badge-caduc rounded px-1.5 py-0.5 text-xs font-medium'>Annulée</span>
            )}
          </div>

          <h3 className={`mt-1.5 font-semibold leading-snug ${annulee ? 'text-muted-foreground line-through decoration-muted-foreground/50' : ''}`}>
            {reunion.commission && !seance ? (
              <Link
                href={`/commissions/${reunion.commission.slug}`}
                className='relative z-[2] line-clamp-2 transition-colors hover:text-primary'
              >
                {titre}
              </Link>
            ) : (
              titre
            )}
          </h3>

          {points.length > 0 && (
            depliee ? (
              <ul className='mt-1.5 list-disc space-y-1 pl-4 text-sm text-muted-foreground marker:text-muted-foreground/50'>
                {points.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            ) : (
              <p className='mt-1 line-clamp-2 text-sm text-muted-foreground'>
                {points[0]}
                {points.length > 1 && (
                  <span className='text-muted-foreground/70'>
                    {' '}· {points.length - 1} autre{points.length > 2 ? 's' : ''} point{points.length > 2 ? 's' : ''}
                  </span>
                )}
              </p>
            )
          )}

          {depliee && scrutins.length > 0 && (
            <div className='relative z-[2] mt-3'>
              <ScrutinsByDossier scrutins={scrutins} label='Scrutins de la séance' />
            </div>
          )}

          <div className='mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground'>
            {/* Pendant le direct, la pastille « Vidéo » ferait doublon et mènerait
                à un enregistrement que la séance n'a pas fini d'écrire. */}
            {reunion.urlVideo && !enDirect && (
              <a
                href={reunion.urlVideo}
                target='_blank'
                rel='noopener noreferrer'
                className={`${PASTILLE_LIEN} relative z-[2] bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-950/30 dark:text-violet-400 dark:hover:bg-violet-950/50`}
              >
                <Video className='h-3 w-3' aria-hidden />
                Vidéo
              </a>
            )}
            {urlCompteRendu && (
              <a
                href={urlCompteRendu}
                target='_blank'
                rel='noopener noreferrer'
                className={`${PASTILLE_LIEN} relative z-[2] bg-muted hover:bg-accent hover:text-foreground`}
              >
                <FileText className='h-3 w-3' aria-hidden />
                Compte rendu
              </a>
            )}
            {scrutins.length > 0 && (
              <span className='inline-flex items-center gap-1'>
                <Vote className='h-3 w-3' aria-hidden />
                {scrutins.length} scrutin{scrutins.length > 1 ? 's' : ''}
              </span>
            )}
            {reunion.nbParticipants > 0 && (
              <span className='inline-flex items-center gap-1'>
                <Users className='h-3 w-3' aria-hidden />
                {reunion.nbParticipants} présent{reunion.nbParticipants > 1 ? 's' : ''}
              </span>
            )}
            {reunion.lieu && (
              <span className='inline-flex min-w-0 max-w-full items-center gap-1'>
                <MapPin className='h-3 w-3 shrink-0' aria-hidden />
                <span className='truncate'>{reunion.lieu}</span>
              </span>
            )}
            {aDeplier && (
              <button
                type='button'
                onClick={() => setDepliee(!depliee)}
                aria-expanded={depliee}
                className='relative z-[2] ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground'
              >
                {depliee ? 'Réduire' : scrutins.length > 0 ? 'Ordre du jour et scrutins' : "Tout l'ordre du jour"}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${depliee ? 'rotate-180' : ''}`} aria-hidden />
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
