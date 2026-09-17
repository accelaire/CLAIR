'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { MapPin, Video, FileText, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { ScrutinsByDossier } from '@/components/scrutins/ScrutinsByDossier';

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

const CHAMBRE_CLASSES: Record<string, string> = {
  assemblee: 'badge-assemblee',
  senat: 'badge-senat',
};

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Fenêtre de direct: dateDebut → dateFin (ou +4h par défaut)
const LIVE_FALLBACK_DURATION_MS = 4 * 60 * 60 * 1000;

function isHappeningNow(reunion: AgendaReunion, now: number): boolean {
  const start = new Date(reunion.dateDebut).getTime();
  const end = reunion.dateFin
    ? new Date(reunion.dateFin).getTime()
    : start + LIVE_FALLBACK_DURATION_MS;
  return now >= start && now <= end;
}


import { deriveChambre } from '@/lib/chambre';
import { urlDuCompteRendu } from '@/lib/compte-rendu-url';

export function ReunionCard({
  reunion,
  liveUrl,
}: {
  reunion: AgendaReunion;
  liveUrl?: string;
}) {
  const STORAGE_KEY = 'agenda-expanded';
  const [expanded, setExpandedRaw] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (!stored) return false;
      const set: string[] = JSON.parse(stored);
      return set.includes(reunion.id);
    } catch { return false; }
  });
  const setExpanded = useCallback((val: boolean) => {
    setExpandedRaw(val);
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      const set: string[] = stored ? JSON.parse(stored) : [];
      if (val && !set.includes(reunion.id)) {
        set.push(reunion.id);
      } else if (!val) {
        const idx = set.indexOf(reunion.id);
        if (idx >= 0) set.splice(idx, 1);
      }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(set));
    } catch { /* noop */ }
  }, [reunion.id]);

  const [now, setNow] = useState(() => Date.now());
  const [isOdjClamped, setIsOdjClamped] = useState(false);
  const odjRef = useRef<HTMLParagraphElement>(null);
  const commissionName = reunion.commission?.nom || reunion.commission?.nomCourt;
  const chambre = deriveChambre(reunion);

  const checkClamp = useCallback(() => {
    const el = odjRef.current;
    if (!el) return;
    setIsOdjClamped(el.scrollHeight > el.clientHeight + 1);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    checkClamp();
  }, [checkClamp, reunion.odjResume]);

  const happeningNow = isHappeningNow(reunion, now);
  const hasScrutins = !!reunion.scrutins && reunion.scrutins.length > 0;
  const hasExpandableContent = isOdjClamped || hasScrutins;

  return (
    <div
      id={`event-${reunion.id}`}
      className={`relative rounded-lg border transition-all hover:border-primary hover:shadow-md scroll-mt-4 ${
        happeningNow
          ? 'border-primary/50 bg-primary/[0.03] dark:bg-primary/[0.06]'
          : 'bg-card'
      }`}
    >
      {/* Le lien étalé : la carte entière mène à la réunion, comme celles d'un
          scrutin ou d'un dossier. On ne peut pas l'envelopper dans un <Link> —
          elle contient déjà des liens (vidéo, compte rendu, scrutins) et des
          boutons, qu'on ne peut pas imbriquer. Le lien couvre donc la carte en
          z-[1], et tout ce qui est cliquable passe en z-[2] juste dessous.

          La carte ouvrait auparavant la vidéo. Elle mène désormais à la page de
          la réunion : c'est la convention du site, et la vidéo garde sa
          pastille. */}
      <Link
        href={`/reunions/${encodeURIComponent(reunion.uid)}`}
        className='absolute inset-0 z-[1] rounded-lg'
      >
        <span className='sr-only'>Voir le détail de la réunion</span>
      </Link>
      <div className='p-4'>
        <div className='flex items-start gap-3'>
          {/* Time column */}
          <div className='shrink-0 w-14 text-center'>
            <div className='text-sm font-semibold tabular-nums'>{formatTime(reunion.dateDebut)}</div>
            {reunion.dateFin && (
              <div className='text-xs text-muted-foreground tabular-nums'>
                — {formatTime(reunion.dateFin)}
              </div>
            )}
          </div>

          {/* Content */}
          <div className='flex-1 min-w-0'>
            {/* Le libellé suit le TYPE de la réunion, pas la présence d'une
                commission rattachée. L'écrire « Séance publique » dès que la
                commission manquait étiquetait 918 réunions de commission comme
                des séances de l'hémicycle — la MECSS, les missions
                d'information, les commissions d'enquête : 62 organes que le
                rattachement ne résout pas encore. */}
            {reunion.commission ? (
              <Link
                href={`/commissions/${reunion.commission.slug}`}
                className='text-sm font-semibold hover:text-primary transition-colors line-clamp-1'
              >
                {commissionName}
              </Link>
            ) : (
              <span className='text-sm font-semibold'>
                {reunion.type === 'seance' ? 'Séance publique' : 'Réunion de commission'}
              </span>
            )}

            {/* ODJ resume — collapsed: 2 lines, expanded: full */}
            {reunion.odjResume && (
              <p
                ref={odjRef}
                className={`mt-0.5 text-xs text-muted-foreground ${expanded ? '' : 'line-clamp-2'}`}
              >
                {reunion.odjResume}
              </p>
            )}

            {/* Scrutins — only shown when expanded, grouped by dossier */}
            {expanded && hasScrutins && (
              <div className='relative z-[2] mt-3'>
                <ScrutinsByDossier
                  scrutins={reunion.scrutins!}
                  label='Scrutins de la séance'
                />
              </div>
            )}

            {/* Meta row */}
            <div className='relative z-[2] mt-2 flex flex-wrap items-center gap-2'>
              {chambre && (
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${CHAMBRE_CLASSES[chambre] || 'bg-muted text-muted-foreground'}`}
                >
                  {chambre === 'assemblee' ? 'AN' : 'Sénat'}
                </span>
              )}

              {liveUrl && happeningNow && (
                <a
                  href={liveUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='flex items-center gap-1.5 px-2 py-0.5 rounded text-xs border bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors font-medium'
                >
                  <span className='relative flex h-2 w-2 shrink-0'>
                    <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75' />
                    <span className='relative inline-flex rounded-full h-2 w-2 bg-red-500' />
                  </span>
                  En direct
                </a>
              )}
              {/* Pendant la réunion, « En direct » dit déjà tout : la pastille
                  « Vidéo » ferait doublon, et elle mènerait à un enregistrement
                  que la séance n'a pas fini d'écrire. On la garde pour l'avant
                  et l'après — c'est là qu'elle apprend quelque chose. */}
              {reunion.urlVideo && !(happeningNow && liveUrl) && (
                <a
                  href={reunion.urlVideo}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='flex items-center gap-1 px-2 py-0.5 rounded text-xs border bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-950/50 transition-colors'
                >
                  <Video className='h-3 w-3' />
                  Vidéo
                </a>
              )}
              {(() => {
                const isPast = new Date(reunion.dateDebut) < new Date();
                const crUrl = isPast && reunion.compteRenduRef ? urlDuCompteRendu(reunion.compteRenduRef) : null;
                if (!crUrl) return null;
                return (
                  <a
                    href={crUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='flex items-center gap-1 px-2 py-0.5 rounded text-xs border bg-muted text-muted-foreground hover:bg-accent hover:text-foreground transition-colors'
                  >
                    <FileText className='h-3 w-3' />
                    Compte rendu
                  </a>
                );
              })()}

              {reunion.nbParticipants > 0 && (
                <span className='flex items-center gap-1 text-xs text-muted-foreground'>
                  <Users className='h-3 w-3' />
                  {reunion.nbParticipants}
                </span>
              )}

              {reunion.lieu && (
                <span className='flex items-center gap-1 text-xs text-muted-foreground'>
                  <MapPin className='h-3 w-3' />
                  <span>{reunion.lieu}</span>
                </span>
              )}
            </div>
          </div>

          {/* Expand toggle — only when ODJ is long enough to be clamped */}
          {hasExpandableContent && (
            <button
              onClick={() => setExpanded(!expanded)}
              className='relative z-[2] shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors'
              aria-label={expanded ? 'Réduire' : 'Développer'}
            >
              {expanded ? (
                <ChevronUp className='h-4 w-4' />
              ) : (
                <ChevronDown className='h-4 w-4' />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
