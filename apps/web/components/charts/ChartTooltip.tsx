'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface ContenuTooltip {
  titre: string;
  lignes: { label: string; valeur: string }[];
  couleur?: string;
}

/**
 * `useLayoutEffect` n'existe pas au rendu serveur, et React le signale par un
 * avertissement à chaque requête. Les pages qui portent ces graphiques sont
 * rendues à la demande : l'avertissement partait donc dans les logs de la
 * fonction à chaque visite. L'effet ne fait que mesurer le DOM — il n'a rien à
 * faire côté serveur, où `useEffect` ne sera de toute façon jamais déclenché.
 */
const useEffetDeMise = typeof window === 'undefined' ? useEffect : useLayoutEffect;

type ChartTooltipHandlers = {
  onMouseEnter: React.MouseEventHandler;
  onMouseMove: React.MouseEventHandler;
  onMouseLeave: React.MouseEventHandler;
  onFocus: React.FocusEventHandler;
  onBlur: React.FocusEventHandler;
  onTouchStart: React.TouchEventHandler;
};

export function useChartTooltip(): {
  tooltip: React.ReactNode;
  handlers: (contenu: ContenuTooltip | null) => ChartTooltipHandlers;
} {
  const [payload, setPayload] = useState<ContenuTooltip | null>(null);
  const [visible, setVisible] = useState(false);
  const [rawPos, setRawPos] = useState({ x: 0, y: 0 });
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Mesure et ajustement avant le paint pour éviter tout flash de débordement
  useEffetDeMise(() => {
    if (!visible || !tooltipRef.current) return;

    const rect = tooltipRef.current.getBoundingClientRect();
    const offset = 12;

    let x = rawPos.x + offset;
    let y = rawPos.y + offset;

    // Si le tooltip dépasse à droite, on le bascule à gauche du curseur
    if (x + rect.width > window.innerWidth) {
      x = rawPos.x - rect.width - offset;
    }
    // Si le tooltip dépasse en bas, on le remonte au-dessus du curseur
    if (y + rect.height > window.innerHeight) {
      y = rawPos.y - rect.height - offset;
    }
    // Sécurité minimum pour ne pas disparaître hors écran en haut / à gauche
    if (x < offset) x = offset;
    if (y < offset) y = offset;

    setPos({ x, y });
  }, [rawPos, visible]);

  // Fermeture au clic ou tap en dehors du tooltip (indispensable sur mobile)
  useEffect(() => {
    if (!visible) return;

    function handleOutside(e: MouseEvent | TouchEvent) {
      if (tooltipRef.current && tooltipRef.current.contains(e.target as Node)) {
        return;
      }
      setVisible(false);
      setPayload(null);
    }

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [visible]);

  const handlers = useCallback(
    (contenu: ContenuTooltip | null): ChartTooltipHandlers => ({
      onMouseEnter: (e) => {
        if (!contenu) return;
        setPayload(contenu);
        setVisible(true);
        setRawPos({ x: e.clientX, y: e.clientY });
      },
      onMouseMove: (e) => {
        // Suivi continu du pointeur pour que le tooltip reste collé au curseur
        setRawPos({ x: e.clientX, y: e.clientY });
      },
      onMouseLeave: () => {
        setVisible(false);
        setPayload(null);
      },
      onFocus: (e) => {
        if (!contenu) return;
        setPayload(contenu);
        setVisible(true);
        const el = e.currentTarget as HTMLElement;
        const rect = el.getBoundingClientRect();
        // Positionnement relatif à l'élément focalisé (pas de curseur au clavier)
        setRawPos({ x: rect.left + rect.width / 2, y: rect.top });
      },
      onBlur: () => {
        setVisible(false);
        setPayload(null);
      },
      onTouchStart: (e) => {
        if (!contenu) return;
        // On stoppe la propagation pour que le listener document ne ferme pas immédiatement le tooltip
        e.stopPropagation();
        setPayload(contenu);
        setVisible(true);
        const touch = e.touches[0];
        if (touch) {
          setRawPos({ x: touch.clientX, y: touch.clientY });
        }
      },
    }),
    []
  );

  const tooltip = (
    <div
      ref={tooltipRef}
      role="tooltip"
      aria-hidden={!visible}
      className={`
        fixed z-50 max-w-60 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md
        pointer-events-none transition-opacity duration-150
        ${visible ? 'opacity-100' : 'opacity-0'}
      `}
      style={{ left: pos.x, top: pos.y }}
    >
      {payload && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            {payload.couleur && (
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: payload.couleur }}
                aria-hidden="true"
              />
            )}
            <span className="font-semibold text-popover-foreground">{payload.titre}</span>
          </div>
          <ul className="space-y-0.5">
            {payload.lignes.map((ligne) => (
              <li key={ligne.label} className="flex justify-between gap-3">
                <span className="text-muted-foreground">{ligne.label}</span>
                <span className="shrink-0 tabular-nums font-medium text-popover-foreground">
                  {ligne.valeur}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return { tooltip, handlers };
}