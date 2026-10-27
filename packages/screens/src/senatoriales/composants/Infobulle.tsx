"use client";

import {
  type FocusEventHandler,
  type MouseEventHandler,
  type ReactNode,
  type TouchEventHandler,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import classes from "./Infobulle.module.css";

export type ContenuInfobulle = {
  titre: string;
  lignes: { label: string; valeur: string }[];
  /** Couleur de la pastille (toujours accompagnée du titre). */
  couleur?: string;
};

type Gestionnaires = {
  onMouseEnter: MouseEventHandler;
  onMouseMove: MouseEventHandler;
  onMouseLeave: MouseEventHandler;
  onFocus: FocusEventHandler;
  onBlur: FocusEventHandler;
  onTouchStart: TouchEventHandler;
};

/** `useLayoutEffect` n'existe pas au rendu serveur : l'effet ne fait que mesurer le DOM. */
const useEffetDeMise = typeof window === "undefined" ? useEffect : useLayoutEffect;

const DECALAGE = 12;

/**
 * Infobulle des graphiques (souris, clavier, toucher), reprise de `useChartTooltip` de apps/web.
 * Une seule bulle à la fois ; elle se replace pour ne pas déborder de l'écran et se ferme au
 * toucher en dehors. Elle double une information déjà lisible (libellé, tableau des données).
 */
export const useInfobulle = (): {
  infobulle: ReactNode;
  gestionnaires: (contenu: ContenuInfobulle | null) => Gestionnaires;
} => {
  const [contenu, setContenu] = useState<ContenuInfobulle | null>(null);
  const [visible, setVisible] = useState(false);
  const [brut, setBrut] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffetDeMise(() => {
    if (!visible || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    let x = brut.x + DECALAGE;
    let y = brut.y + DECALAGE;
    if (x + rect.width > window.innerWidth) x = brut.x - rect.width - DECALAGE;
    if (y + rect.height > window.innerHeight) y = brut.y - rect.height - DECALAGE;
    setPosition({ x: Math.max(x, DECALAGE), y: Math.max(y, DECALAGE) });
  }, [brut, visible]);

  useEffect(() => {
    if (!visible) return;
    const fermer = (event: MouseEvent | TouchEvent) => {
      if (event.target instanceof Node && ref.current?.contains(event.target)) return;
      setVisible(false);
      setContenu(null);
    };
    document.addEventListener("mousedown", fermer);
    document.addEventListener("touchstart", fermer, { passive: true });
    return () => {
      document.removeEventListener("mousedown", fermer);
      document.removeEventListener("touchstart", fermer);
    };
  }, [visible]);

  const gestionnaires = useCallback(
    (valeur: ContenuInfobulle | null): Gestionnaires => ({
      onMouseEnter: (event) => {
        if (!valeur) return;
        setContenu(valeur);
        setVisible(true);
        setBrut({ x: event.clientX, y: event.clientY });
      },
      onMouseMove: (event) => setBrut({ x: event.clientX, y: event.clientY }),
      onMouseLeave: () => {
        setVisible(false);
        setContenu(null);
      },
      onFocus: (event) => {
        if (!valeur) return;
        setContenu(valeur);
        setVisible(true);
        const rect = event.currentTarget.getBoundingClientRect();
        setBrut({ x: rect.left + rect.width / 2, y: rect.top });
      },
      onBlur: () => {
        setVisible(false);
        setContenu(null);
      },
      onTouchStart: (event) => {
        if (!valeur) return;
        event.stopPropagation();
        setContenu(valeur);
        setVisible(true);
        const toucher = event.touches[0];
        if (toucher) setBrut({ x: toucher.clientX, y: toucher.clientY });
      },
    }),
    [],
  );

  const infobulle = (
    <div
      ref={ref}
      role="tooltip"
      aria-hidden={!visible}
      className={classes.bulle}
      data-visible={visible || undefined}
      style={{ left: position.x, top: position.y }}
    >
      {contenu ? (
        <>
          <p className={classes.titre}>
            {contenu.couleur ? (
              <span
                className={classes.pastille}
                style={{ backgroundColor: contenu.couleur }}
                aria-hidden="true"
              />
            ) : null}
            {contenu.titre}
          </p>
          <ul className={classes.lignes}>
            {contenu.lignes.map((ligne) => (
              <li key={ligne.label}>
                <span className={classes.label}>{ligne.label}</span>
                <span className={`${classes.valeur} clair-chiffres`}>{ligne.valeur}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );

  return { infobulle, gestionnaires };
};
