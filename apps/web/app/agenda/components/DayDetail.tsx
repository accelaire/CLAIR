'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { ReunionCard, type AgendaReunion } from './ReunionCard';
import { EvenementCard, type AgendaEvenement } from './EvenementCard';
import { useLiveNow } from '@/hooks/useLiveNow';
import { directsDesReunions, estEnCours, jourAParis } from '@/lib/live-url';
import {
  LIBELLE_MOMENT,
  estAnnulee,
  estSansHoraire,
  finPresumee,
  momentDeLaReunion,
  rangsDesSeances,
  type Moment,
} from '@/lib/agenda';

interface DayDetailProps {
  selectedDate: string | null; // 'YYYY-MM-DD'
  reunions: AgendaReunion[];
  /** Repères institutionnels du jour : ponctuels, ou périodes le couvrant. */
  evenements: AgendaEvenement[];
  /** Aujourd'hui seulement : les réunions d'hier, dont on garde celles qui durent encore. */
  veille?: AgendaReunion[];
  onNavigate: (date: string) => void;
}

const DAY_NAMES_FULL = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTH_NAMES = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];
const MOMENTS: Moment[] = ['matin', 'apres-midi', 'soir'];

function formatDayTitle(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const dayName = DAY_NAMES_FULL[date.getDay()]!;
  return `${dayName} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]!} ${date.getFullYear()}`;
}

function decaler(dateStr: string, jours: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

function compte(n: number, singulier: string, pluriel: string): string {
  return `${n} ${n > 1 ? pluriel : singulier}`;
}

/** Intitulé de section : la typographie de « Ordre du jour » sur la page d'une réunion. */
function Section({ titre, nombre, children }: { titre: string; nombre: number; children: React.ReactNode }) {
  return (
    <section className='space-y-2'>
      <h4 className='flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
        {titre}
        <span className='font-normal normal-case tracking-normal text-muted-foreground/70'>{nombre}</span>
      </h4>
      {children}
    </section>
  );
}

/** Une liste repliée sous un bouton : réunions terminées, réunions annulées. */
function Repli({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div>
      <button
        type='button'
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        className='inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
      >
        {libelle}
        <ChevronDown className={`h-4 w-4 transition-transform ${ouvert ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {ouvert && <div className='mt-2 space-y-2'>{children}</div>}
    </div>
  );
}

const BOUTON_ICONE =
  'rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground';

const AUCUNE: AgendaReunion[] = [];

export function DayDetail({ selectedDate, reunions, evenements, veille = AUCUNE, onNavigate }: DayDetailProps) {
  const live = useLiveNow();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);


  // La veille entre dans le calcul des directs et des rangs : chacune reste
  // rattachée à SON jour (une séance d'hier n'est pas relayée par celle d'aujourd'hui).
  const toutes = useMemo(() => {
    const ids = new Set(reunions.map((r) => r.id));
    return [...veille.filter((r) => !ids.has(r.id)), ...reunions];
  }, [reunions, veille]);
  const directs = useMemo(() => directsDesReunions(toutes, live, now), [toutes, live, now]);
  const rangs = useMemo(() => rangsDesSeances(toutes), [toutes]);
  const aujourdhui = selectedDate === jourAParis(now);

  /** Commencées hier, encore en direct ou dans leur durée. */
  const depuisHier = useMemo(() => {
    if (!aujourdhui) return [];
    const ids = new Set(reunions.map((r) => r.id));
    return veille.filter(
      (r) => !ids.has(r.id) && !estAnnulee(r) && !estSansHoraire(r) && (directs.has(r.id) || estEnCours(r, now)),
    );
  }, [aujourdhui, reunions, veille, directs, now]);

  /**
   * Aujourd'hui, la journée se lit depuis l'instant présent : ce qui se tient
   * en ce moment, puis ce qui vient, et ce qui est fini replié en bas. Il
   * fallait sinon faire défiler vingt réunions closes pour trouver le direct.
   * Les autres jours se lisent du matin au soir.
   */
  const { enCeMoment, journee, parMoment, terminees, annulees } = useMemo(() => {
    const triees = [...reunions].sort((a, b) => a.dateDebut.localeCompare(b.dateDebut));
    const annulees = triees.filter(estAnnulee);
    const actives = triees.filter((r) => !estAnnulee(r));
    const journee = actives.filter(estSansHoraire);
    const minutees = actives.filter((r) => !estSansHoraire(r));

    const enCeMoment = aujourdhui
      ? [...depuisHier, ...minutees.filter((r) => directs.has(r.id) || estEnCours(r, now))]
      : [];
    const terminees = aujourdhui
      ? minutees.filter((r) => !enCeMoment.includes(r) && finPresumee(r) < now)
      : [];
    const parMoment = new Map<Moment, AgendaReunion[]>();
    for (const r of minutees) {
      if (enCeMoment.includes(r) || terminees.includes(r)) continue;
      const m = momentDeLaReunion(r);
      parMoment.set(m, [...(parMoment.get(m) ?? []), r]);
    }
    return { enCeMoment, journee, parMoment, terminees, annulees };
  }, [reunions, aujourdhui, directs, now, depuisHier]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.location.hash || reunions.length === 0) return;
    const el = document.getElementById(window.location.hash.slice(1));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [reunions.length]);

  if (!selectedDate) {
    return (
      <div className='flex flex-col items-center justify-center py-16 text-center text-muted-foreground'>
        <Calendar className='mb-3 h-10 w-10 opacity-30' />
        <p className='text-sm'>Sélectionnez un jour dans le calendrier</p>
      </div>
    );
  }

  const aVenir = [...parMoment.values()].reduce((n, l) => n + l.length, 0);
  const resume = [
    compte(reunions.length - annulees.length, 'réunion', 'réunions'),
    depuisHier.length > 0 ? `${depuisHier.length} commencée${depuisHier.length > 1 ? 's' : ''} hier` : null,
    directs.size > 0 ? `${directs.size} en direct` : null,
    aujourdhui && aVenir > 0 ? `${aVenir} à venir` : null,
    annulees.length > 0 ? compte(annulees.length, 'annulée', 'annulées') : null,
  ].filter(Boolean).join(' · ');

  const statutDe = (r: AgendaReunion): 'normale' | 'en-cours' =>
    aujourdhui && estEnCours(r, now) ? 'en-cours' : 'normale';

  const carte = (r: AgendaReunion) => (
    <ReunionCard
      key={r.id}
      reunion={r}
      liveUrl={directs.get(r.id)}
      statut={statutDe(r)}
      rang={rangs.get(r.id)}
      depuisHier={depuisHier.includes(r)}
    />
  );

  return (
    <div>
      <div className='mb-5 flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <h3 className='text-lg font-semibold first-letter:uppercase'>{formatDayTitle(selectedDate)}</h3>
          <p className='mt-0.5 text-sm text-muted-foreground'>
            {reunions.length + depuisHier.length > 0 ? resume : 'Aucune réunion'}
          </p>
        </div>
        <div className='flex shrink-0 items-center gap-1'>
          <button type='button' onClick={() => onNavigate(decaler(selectedDate, -1))} className={BOUTON_ICONE} aria-label='Jour précédent'>
            <ChevronLeft className='h-4 w-4' />
          </button>
          <button type='button' onClick={() => onNavigate(decaler(selectedDate, 1))} className={BOUTON_ICONE} aria-label='Jour suivant'>
            <ChevronRight className='h-4 w-4' />
          </button>
        </div>
      </div>

      <div className='space-y-6'>
        {/* Les repères institutionnels passent devant : ils donnent le contexte
            dans lequel se lisent les réunions du jour (ou leur absence). */}
        {evenements.length > 0 && (
          <div className='space-y-2'>
            {evenements.map((e) => <EvenementCard key={e.id} evenement={e} />)}
          </div>
        )}

        {reunions.length === 0 && depuisHier.length === 0 && (
          <div className='flex flex-col items-center justify-center py-10 text-center text-muted-foreground'>
            <Calendar className='mb-3 h-8 w-8 opacity-30' />
            <p className='text-sm'>Ni séance ni réunion ce jour-là.</p>
          </div>
        )}

        {/* Déplacements et missions de plusieurs jours : sans heure, ils
            n'ont pas leur place dans le fil de la journée. */}
        {enCeMoment.length > 0 && (
          <Section titre='En ce moment' nombre={enCeMoment.length}>
            <div className='space-y-2'>{enCeMoment.map(carte)}</div>
          </Section>
        )}

        {journee.length > 0 && (
          <Section titre='Toute la journée' nombre={journee.length}>
            <div className='space-y-2'>{journee.map(carte)}</div>
          </Section>
        )}

        {MOMENTS.filter((m) => parMoment.has(m)).map((m) => (
          <Section
            key={m}
            titre={aujourdhui ? `À venir · ${LIBELLE_MOMENT[m].toLowerCase()}` : LIBELLE_MOMENT[m]}
            nombre={parMoment.get(m)!.length}
          >
            <div className='space-y-2'>{parMoment.get(m)!.map(carte)}</div>
          </Section>
        ))}

        {(terminees.length > 0 || annulees.length > 0) && (
          <div className='space-y-1'>
            {terminees.length > 0 && (
              <Repli key={`t-${selectedDate}`} libelle={compte(terminees.length, 'réunion terminée', 'réunions terminées')}>
                {terminees.map(carte)}
              </Repli>
            )}
            {/* Une réunion annulée est le plus souvent remplacée par une autre à
                une autre heure : la laisser parmi les autres doublait la journée. */}
            {annulees.length > 0 && (
              <Repli key={`a-${selectedDate}`} libelle={compte(annulees.length, 'réunion annulée', 'réunions annulées')}>
                {annulees.map(carte)}
              </Repli>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
