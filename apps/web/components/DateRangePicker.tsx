'use client';

import { createContext, useContext, useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { PeriodePreset } from '@/lib/periodes';

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export interface DateRangePickerProps {
  value: DateRange;
  onChange: (value: DateRange) => void;
  placeholder?: string;
  /** Show preset options */
  showPresets?: boolean;
  /**
   * Date la plus ancienne pertinente (ex: début du mandat). Borne le calendrier
   * vers le passé et alimente les raccourcis par année + « depuis le début ».
   */
  minDate?: Date;
  /** Date la plus récente sélectionnable (défaut: aujourd'hui). */
  maxDate?: Date;
  /**
   * Libellé du raccourci « depuis minDate jusqu'à maintenant »
   * (ex: « Depuis le début du mandat »). Affiché uniquement si minDate est fourni.
   */
  startLabel?: string;
  /** Nombre de résultats sur la période active, affiché en badge sur le bouton. */
  resultCount?: number | null;
  /**
   * Périodes institutionnelles proposées en raccourci (législatures AN, sessions
   * Sénat). Une période étant un intervalle de dates, le raccourci se résout en
   * une simple plage : aucun paramètre d'API supplémentaire n'est nécessaire.
   * Les périodes sont regroupées par `groupe` dans l'ordre reçu.
   */
  periodPresets?: PeriodePreset[];
  /**
   * Appelé — **à la place de `onChange`** — quand une période institutionnelle est
   * choisie. La page doit alors écrire elle-même la plage de dates ET ses autres
   * filtres (typiquement la chambre : une législature n'existe qu'à l'Assemblée,
   * une session ordinaire qu'au Sénat) en une seule mise à jour d'URL. Deux
   * écritures séparées se courent après : la seconde repart d'un `searchParams`
   * périmé et écrase la première.
   */
  onPeriodSelect?: (periode: PeriodePreset) => void;
}

/**
 * Vrai quand le sélecteur est déjà dans un panneau (la feuille « Filtres » de
 * `FilterBar` sur mobile) : il s'y déplie en place au lieu d'ouvrir son propre
 * panneau par-dessus.
 */
export const DateRangePickerEnLigne = createContext(false);

/** Sous `sm` (640 px), le calendrier s'ouvre en panneau bas, pleine largeur. */
const REQUETE_MOBILE = '(max-width: 639px)';

/** Marge gardée entre le menu déroulant et le bord de l'écran. */
const MARGE_ECRAN = 8;

interface PresetOption {
  label: string;
  getValue: () => DateRange;
}

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const DAYS_FR = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** "28 juin" (sans année) */
function formatDay(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** "28 juin 2025" */
function formatDayYear(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isJan1(d: Date): boolean {
  return d.getMonth() === 0 && d.getDate() === 1;
}

function isDec31(d: Date): boolean {
  return d.getMonth() === 11 && d.getDate() === 31;
}

function isSameDay(d1: Date | null, d2: Date | null): boolean {
  if (!d1 || !d2) return false;
  return d1.toDateString() === d2.toDateString();
}

function isInRange(date: Date, from: Date | null, to: Date | null): boolean {
  if (!from || !to) return false;
  const time = date.getTime();
  return time >= from.getTime() && time <= to.getTime();
}

/** Formate une date en YYYY-MM-DD dans le fuseau local (évite le décalage d'un jour de toISOString). */
function toLocalYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Get the day of week for the first day (0 = Sunday, 1 = Monday, etc.)
  // Convert to Monday-based (0 = Monday, 6 = Sunday)
  let startDayOfWeek = firstDay.getDay() - 1;
  if (startDayOfWeek < 0) startDayOfWeek = 6;

  // Add days from previous month to fill the first week
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push(d);
  }

  // Add all days of the current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i));
  }

  // Add days from next month to fill the last week
  const remaining = 42 - days.length; // 6 weeks * 7 days
  for (let i = 1; i <= remaining; i++) {
    days.push(new Date(year, month + 1, i));
  }

  return days;
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = 'Sélectionner une période',
  showPresets = true,
  minDate,
  maxDate,
  startLabel,
  resultCount,
  periodPresets,
  onPeriodSelect,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => value.from || new Date());
  const [selecting, setSelecting] = useState<'from' | 'to'>('from');
  const [tempFrom, setTempFrom] = useState<Date | null>(value.from);
  const [tempTo, setTempTo] = useState<Date | null>(value.to);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const enLigne = useContext(DateRangePickerEnLigne);
  const [mobile, setMobile] = useState(false);
  // Le menu s'ancre au bord droit du bouton, ou au gauche quand il sortirait
  // de l'écran de ce côté (bouton en début de ligne).
  const [alignement, setAlignement] = useState<'gauche' | 'droite'>('droite');
  // Sur mobile, hors d'un panneau qui l'accueille déjà : panneau bas.
  const panneau = mobile && !enLigne;

  useEffect(() => {
    const mq = window.matchMedia(REQUETE_MOBILE);
    const maj = () => setMobile(mq.matches);
    maj();
    mq.addEventListener('change', maj);
    return () => mq.removeEventListener('change', maj);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen || panneau) return;
    const bouton = containerRef.current?.getBoundingClientRect();
    const largeur = dropdownRef.current?.offsetWidth;
    if (!bouton || !largeur) return;
    const debordeAGauche = bouton.right - largeur < MARGE_ECRAN;
    const tientAGauche = bouton.left + largeur <= window.innerWidth - MARGE_ECRAN;
    setAlignement(debordeAGauche && tientAGauche ? 'gauche' : 'droite');
  }, [isOpen, panneau]);

  // Échap ferme ; le panneau bas bloque le défilement de la page dessous.
  useEffect(() => {
    if (!isOpen) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', surTouche);
    const overflowAvant = document.body.style.overflow;
    if (panneau) document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', surTouche);
      if (panneau) document.body.style.overflow = overflowAvant;
    };
  }, [isOpen, panneau]);

  const today = useMemo(() => startOfDay(new Date()), []);
  const effectiveMax = useMemo(
    () => startOfDay(maxDate ?? today),
    [maxDate, today]
  );
  const maxYear = effectiveMax.getFullYear();
  // Borne basse de navigation du calendrier : large par défaut pour ne masquer
  // aucune donnée historique sur les pages sans contexte de mandat.
  const navMinYear = minDate ? minDate.getFullYear() : maxYear - 12;
  // Raccourcis « par année » : depuis le début du mandat si connu, sinon 3 ans récents.
  const yearPresetMinYear = minDate ? minDate.getFullYear() : maxYear - 2;

  // Close on outside click (le panneau bas est rendu hors du conteneur)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const cible = event.target as Node;
      if (containerRef.current?.contains(cible) || dropdownRef.current?.contains(cible)) return;
      setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset temp values when opening
  useEffect(() => {
    if (isOpen) {
      setTempFrom(value.from);
      setTempTo(value.to);
      setSelecting('from');
      setViewDate(value.from || effectiveMax);
    }
  }, [isOpen, value.from, value.to, effectiveMax]);

  const { quickPresets, yearPresets } = useMemo(() => {
    const quick: PresetOption[] = [
      { label: 'Tout', getValue: () => ({ from: null, to: null }) },
    ];
    if (startLabel && minDate) {
      quick.push({ label: startLabel, getValue: () => ({ from: startOfDay(minDate), to: null }) });
    }
    quick.push(
      {
        label: '30 derniers jours',
        getValue: () => {
          const to = new Date(effectiveMax);
          const from = new Date(effectiveMax);
          from.setDate(from.getDate() - 30);
          return { from, to };
        },
      },
      {
        label: '3 derniers mois',
        getValue: () => {
          const to = new Date(effectiveMax);
          const from = new Date(effectiveMax);
          from.setMonth(from.getMonth() - 3);
          return { from, to };
        },
      },
      {
        label: '12 derniers mois',
        getValue: () => {
          const to = new Date(effectiveMax);
          const from = new Date(effectiveMax);
          from.setFullYear(from.getFullYear() - 1);
          return { from, to };
        },
      },
    );

    const years: PresetOption[] = [];
    for (let y = maxYear; y >= yearPresetMinYear; y--) {
      years.push({
        label: String(y),
        getValue: () => ({
          from: new Date(y, 0, 1),
          to: y === maxYear ? new Date(effectiveMax) : new Date(y, 11, 31),
        }),
      });
    }

    return { quickPresets: quick, yearPresets: years };
  }, [minDate, effectiveMax, startLabel, yearPresetMinYear, maxYear]);

  // Périodes institutionnelles regroupées par intitulé, dans l'ordre reçu.
  const periodGroups = useMemo(() => {
    const groups = new Map<string, PeriodePreset[]>();
    for (const p of periodPresets ?? []) {
      const existing = groups.get(p.groupe);
      if (existing) existing.push(p);
      else groups.set(p.groupe, [p]);
    }
    return Array.from(groups.entries());
  }, [periodPresets]);

  // Période dont les bornes correspondent exactement à la sélection : permet
  // d'afficher « XVIe législature » plutôt que la plage de dates brute.
  const activePeriod = useMemo(
    () =>
      periodPresets?.find(
        (p) => isSameDay(p.from, value.from) && isSameDay(p.to, value.to)
      ) ?? null,
    [periodPresets, value.from, value.to]
  );

  const days = useMemo(
    () => getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth()),
    [viewDate]
  );

  const handleDayClick = (day: Date) => {
    if (selecting === 'from') {
      setTempFrom(day);
      setTempTo(null);
      setSelecting('to');
    } else {
      // If clicked date is before tempFrom, swap them
      if (tempFrom && day < tempFrom) {
        setTempTo(tempFrom);
        setTempFrom(day);
      } else {
        setTempTo(day);
      }
      // Apply the selection
      const finalFrom = tempFrom && day < tempFrom ? day : tempFrom;
      const finalTo = tempFrom && day < tempFrom ? tempFrom : day;
      onChange({ from: finalFrom, to: finalTo });
      setIsOpen(false);
    }
  };

  const handlePresetClick = (preset: PresetOption) => {
    const range = preset.getValue();
    onChange(range);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ from: null, to: null });
  };

  // Borne la vue du calendrier à [minYear janvier, maxMonth]
  const clampView = (year: number, month: number) => {
    let d = new Date(year, month, 1);
    const maxMonthStart = new Date(maxYear, effectiveMax.getMonth(), 1);
    const minMonthStart = new Date(navMinYear, 0, 1);
    if (d > maxMonthStart) d = maxMonthStart;
    if (d < minMonthStart) d = minMonthStart;
    setViewDate(d);
  };

  const canPrev =
    viewDate.getFullYear() > navMinYear ||
    (viewDate.getFullYear() === navMinYear && viewDate.getMonth() > 0);
  const canNext =
    viewDate.getFullYear() < maxYear ||
    (viewDate.getFullYear() === maxYear && viewDate.getMonth() < effectiveMax.getMonth());

  const prevMonth = () => {
    if (canPrev) clampView(viewDate.getFullYear(), viewDate.getMonth() - 1);
  };

  const nextMonth = () => {
    if (canNext) clampView(viewDate.getFullYear(), viewDate.getMonth() + 1);
  };

  const yearOptions = useMemo(() => {
    const arr: number[] = [];
    for (let y = maxYear; y >= navMinYear; y--) arr.push(y);
    return arr;
  }, [navMinYear, maxYear]);

  const displayValue = useMemo(() => {
    const { from, to } = value;
    if (!from && !to) return null;
    if (activePeriod) return activePeriod.label;
    if (from && to) {
      const sameYear = from.getFullYear() === to.getFullYear();
      // Année calendaire complète (ou année en cours jusqu'à aujourd'hui)
      if (sameYear && isJan1(from) && (isDec31(to) || isSameDay(to, effectiveMax))) {
        return `Année ${from.getFullYear()}`;
      }
      if (sameYear) {
        // L'année n'apparaît qu'une fois, à la fin
        return `${formatDay(from)} → ${formatDayYear(to)}`;
      }
      return `${formatDayYear(from)} → ${formatDayYear(to)}`;
    }
    if (from) {
      if (startLabel && minDate && isSameDay(from, minDate)) return startLabel;
      return `Depuis le ${formatDayYear(from)}`;
    }
    return null;
  }, [value, startLabel, minDate, effectiveMax, activePeriod]);

  // Sur mobile, les raccourcis passent en puces au-dessus du calendrier : côte
  // à côte, raccourcis et calendrier dépassaient de l'écran.
  const classeRaccourci = (actif = false) =>
    mobile
      ? `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
          actif ? 'border-primary/30 bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
        }`
      : `flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm rounded hover:bg-muted transition-colors ${
          actif ? 'bg-primary/10 text-primary font-medium' : ''
        }`;
  const classeIntertitre = (premier = false) =>
    mobile
      ? 'mb-1.5 px-2 text-xs font-medium text-muted-foreground'
      : `text-xs font-medium text-muted-foreground px-2 py-1 mb-1 ${premier ? '' : 'mt-2 border-t pt-2'}`;
  const classeGroupe = mobile ? 'flex flex-wrap gap-2 px-2' : '';

  const raccourcis = showPresets && (
    <div
      className={
        mobile ? 'space-y-3' : 'border-r bg-muted/30 p-2 min-w-[175px] max-h-[340px] overflow-y-auto'
      }
    >
      <div>
        <div className={classeIntertitre(true)}>Raccourcis</div>
        <div className={classeGroupe}>
          {quickPresets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handlePresetClick(preset)}
              className={classeRaccourci()}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
      {periodGroups.map(([groupe, periodes]) => (
        <div key={groupe}>
          <div className={classeIntertitre()}>{groupe}</div>
          <div className={classeGroupe}>
            {periodes.map((periode) => (
              <button
                key={periode.key}
                type="button"
                onClick={() => {
                  if (onPeriodSelect) onPeriodSelect(periode);
                  else onChange({ from: periode.from, to: periode.to });
                  setIsOpen(false);
                }}
                className={classeRaccourci(activePeriod?.key === periode.key)}
              >
                <span className="truncate">{periode.label}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {periode.count.toLocaleString('fr-FR')}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
      {yearPresets.length > 0 && (
        <div>
          <div className={classeIntertitre()}>Par année</div>
          <div className={classeGroupe}>
            {yearPresets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handlePresetClick(preset)}
                className={classeRaccourci()}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Cases de 40 px sur mobile, à la taille du doigt ; 32 px à la souris.
  const tailleCase = mobile ? 'h-10 w-full' : 'h-8 w-8';

  const calendrier = (
    <div className={mobile ? 'border-t px-2 pt-3' : 'p-3'}>
      {mobile && <div className="mb-2 text-xs font-medium text-muted-foreground">Ou choisir les dates</div>}
      {/* Header with selection state */}
      <div className="flex items-center gap-2 mb-3 text-sm">
        <button
          type="button"
          className={`flex-1 px-3 py-1.5 rounded border text-center transition-colors ${
            selecting === 'from'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-transparent hover:bg-muted'
          }`}
          onClick={() => setSelecting('from')}
        >
          {tempFrom ? formatDay(tempFrom) : 'Début'}
        </button>
        <span className="text-muted-foreground">→</span>
        <button
          type="button"
          className={`flex-1 px-3 py-1.5 rounded border text-center transition-colors ${
            selecting === 'to'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-transparent hover:bg-muted'
          }`}
          onClick={() => setSelecting('to')}
        >
          {tempTo ? formatDay(tempTo) : 'Fin'}
        </button>
      </div>

      {/* Month / year navigation */}
      <div className="flex items-center justify-between gap-1 mb-3">
        <button
          type="button"
          onClick={prevMonth}
          disabled={!canPrev}
          aria-label="Mois précédent"
          className="p-1 hover:bg-muted rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1">
          <select
            value={viewDate.getMonth()}
            onChange={(e) => clampView(viewDate.getFullYear(), Number(e.target.value))}
            className="text-sm font-medium bg-transparent rounded px-1 py-0.5 hover:bg-muted focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            aria-label="Mois"
          >
            {MONTHS_FR.map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </select>
          <select
            value={viewDate.getFullYear()}
            onChange={(e) => clampView(Number(e.target.value), viewDate.getMonth())}
            className="text-sm font-medium bg-transparent rounded px-1 py-0.5 hover:bg-muted focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            aria-label="Année"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={nextMonth}
          disabled={!canNext}
          aria-label="Mois suivant"
          className="p-1 hover:bg-muted rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS_FR.map((day) => (
          <div
            key={day}
            className={`${tailleCase} flex items-center justify-center text-xs font-medium text-muted-foreground`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          const isCurrentMonth = day.getMonth() === viewDate.getMonth();
          const isFuture = startOfDay(day) > effectiveMax;
          const isDisabled = !isCurrentMonth || isFuture;
          const isToday = isSameDay(day, today);
          const isSelected = isSameDay(day, tempFrom) || isSameDay(day, tempTo);
          const isRangeStart = isSameDay(day, tempFrom);
          const isRangeEnd = isSameDay(day, tempTo);
          const inRange = isInRange(day, tempFrom, tempTo);

          return (
            <button
              key={i}
              type="button"
              onClick={() => handleDayClick(day)}
              disabled={isDisabled}
              className={`
                ${tailleCase} flex items-center justify-center text-sm rounded transition-colors
                ${isDisabled ? 'text-muted-foreground/30 cursor-default' : 'hover:bg-muted'}
                ${isToday && !isSelected ? 'font-bold text-primary' : ''}
                ${isSelected ? 'bg-primary text-primary-foreground font-medium' : ''}
                ${inRange && !isSelected ? 'bg-primary/10' : ''}
                ${isRangeStart && tempTo ? 'rounded-r-none' : ''}
                ${isRangeEnd && tempFrom ? 'rounded-l-none' : ''}
                ${inRange && !isRangeStart && !isRangeEnd ? 'rounded-none' : ''}
              `}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 rounded-lg border bg-background px-4 py-2
          hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary
          transition-colors min-w-[200px]
          ${isOpen ? 'border-primary ring-2 ring-primary/20' : ''}
        `}
      >
        <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className={`flex-1 text-left ${displayValue ? '' : 'text-muted-foreground'}`}>
          {displayValue || placeholder}
        </span>
        {displayValue && typeof resultCount === 'number' && (
          <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium flex-shrink-0">
            {resultCount.toLocaleString('fr-FR')}
          </span>
        )}
        {displayValue && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Effacer le filtre de période"
            onClick={handleClear}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClear(e as unknown as React.MouseEvent);
              }
            }}
            className="p-0.5 hover:bg-muted rounded transition-colors flex-shrink-0"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        )}
      </button>

      {isOpen && !panneau && (
        <div
          ref={dropdownRef}
          data-date-dropdown
          className={`absolute top-full mt-2 z-50 rounded-lg border bg-background shadow-lg overflow-hidden ${
            alignement === 'gauche' ? 'left-0' : 'right-0'
          }`}
        >
          {mobile ? (
            // Dans la feuille « Filtres » sur mobile : empilé, pleine largeur.
            <div className="space-y-3 py-2">
              {raccourcis}
              {calendrier}
            </div>
          ) : (
            <div className="flex">
              {raccourcis}
              {calendrier}
            </div>
          )}
        </div>
      )}

      {isOpen && panneau &&
        createPortal(
          <>
            <div className="fixed inset-0 z-50 bg-black/50" aria-hidden="true" />
            <div
              ref={dropdownRef}
              role="dialog"
              aria-modal="true"
              aria-label="Choisir une période"
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-2xl bg-background shadow-xl"
            >
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h3 className="text-base font-semibold">Période</h3>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Fermer"
                  className="rounded-full p-1.5 hover:bg-muted transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-2 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {raccourcis}
                {calendrier}
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

// Helper to convert DateRange to API params (dates locales, sans décalage de fuseau)
export function dateRangeToParams(range: DateRange): { dateFrom?: string; dateTo?: string } {
  return {
    ...(range.from && { dateFrom: toLocalYMD(range.from) }),
    ...(range.to && { dateTo: toLocalYMD(range.to) }),
  };
}

export default DateRangePicker;
