import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type MermaidProps = {
  chart?: string;
  children?: string;
  title?: string;
  caption?: string;
};

export function Mermaid({ chart, children, title, caption }: MermaidProps): React.ReactElement | null {
  const content = (chart || children || "").trim();
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const rawId = useId();
  const id = `mermaid-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  // Détection des dimensions naturelles du SVG à partir du viewBox
  const nativeDimensions = useMemo<{ width: number; height: number } | null>(() => {
    if (!svg) return null;
    const match = svg.match(/viewBox=["']\s*([-\d.]+)[,\s]+([-\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)\s*["']/i);
    if (match) {
      const width = parseFloat(match[3]);
      const height = parseFloat(match[4]);
      if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
        return { width, height };
      }
    }
    return null;
  }, [svg]);

  useEffect(() => {
    let isMounted = true;

    async function renderChart() {
      if (typeof window === "undefined" || !content) {
        return;
      }

      try {
        const mermaid = (await import("mermaid")).default;
        const isDark = document.documentElement.classList.contains("dark");

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: isDark ? "dark" : "default",
          themeVariables: isDark
            ? {
                primaryColor: "#1d70f5",
                primaryTextColor: "#FFFFFF",
                primaryBorderColor: "#3b82f6",
                lineColor: "#94969c",
                secondaryColor: "#12151b",
                tertiaryColor: "#0c0e12",
                background: "#0c0e12",
                mainBkg: "#12151b",
                nodeBorder: "#3b82f6",
                clusterBkg: "#12151b",
                clusterBorder: "#22262f",
                defaultLinkColor: "#60a5fa",
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: "14px",
              }
            : {
                primaryColor: "#eff6ff",
                primaryTextColor: "#020817",
                primaryBorderColor: "#1d70f5",
                lineColor: "#64748b",
                secondaryColor: "#f8fafc",
                tertiaryColor: "#ffffff",
                background: "#FFFFFF",
                mainBkg: "#FFFFFF",
                nodeBorder: "#1d70f5",
                clusterBkg: "#f8fafc",
                clusterBorder: "#e2e8f0",
                defaultLinkColor: "#1d70f5",
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: "14px",
              },
        });

        const uniqueId = `${id}-${Date.now()}`;
        const { svg: renderedSvg } = await mermaid.render(uniqueId, content);

        if (isMounted) {
          setSvg(renderedSvg);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          console.warn("Mermaid render error:", err);
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    renderChart();

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes" && m.attributeName === "class") {
          renderChart();
        }
      }
    });

    if (typeof document !== "undefined") {
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    }

    return () => {
      isMounted = false;
      observer.disconnect();
    };
  }, [content, id]);

  // Calcul du zoom adapté à la taille de l'écran
  const getInitialFitZoom = useCallback((width?: number, height?: number) => {
    if (!width || !height || typeof window === "undefined") return 1;
    const availW = window.innerWidth * 0.88;
    const availH = (window.innerHeight - 90) * 0.88;
    const fitZoom = Math.min(availW / width, availH / height, 1.2);
    return Number(Math.max(fitZoom, 0.25).toFixed(2));
  }, []);

  const handleOpenFullscreen = useCallback((e: React.MouseEvent<HTMLElement>) => {
    triggerRef.current = e.currentTarget;
    setIsFullscreen(true);
    const initialZoom = getInitialFitZoom(nativeDimensions?.width, nativeDimensions?.height);
    setZoom(initialZoom);
    setPan({ x: 0, y: 0 });
  }, [getInitialFitZoom, nativeDimensions]);

  const handleCloseFullscreen = useCallback(() => {
    setIsFullscreen(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    triggerRef.current?.focus();
  }, []);

  const handleReset = useCallback(() => {
    const initialZoom = getInitialFitZoom(nativeDimensions?.width, nativeDimensions?.height);
    setZoom(initialZoom);
    setPan({ x: 0, y: 0 });
  }, [getInitialFitZoom, nativeDimensions]);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(Number((z + 0.25).toFixed(2)), 6));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(Number((z - 0.25).toFixed(2)), 0.2));
  }, []);

  // Gestion du Drag & Pan avec Pointer Capture (support souris + touch)
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Clic gauche uniquement
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [pan]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  }, [isDragging]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
  }, []);

  // Écouteur de molette non-passif pour éviter l'erreur passive event listener
  useEffect(() => {
    if (!isFullscreen) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.88;
      setZoom((prevZoom) => {
        const nextZoom = Math.min(Math.max(prevZoom * zoomFactor, 0.15), 8);
        return Number(nextZoom.toFixed(2));
      });
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", onWheel);
    };
  }, [isFullscreen]);

  // Verrouillage du scroll arrière-plan en mode plein écran
  useEffect(() => {
    if (!isFullscreen || typeof document === "undefined") return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isFullscreen]);

  // Raccourcis clavier
  useEffect(() => {
    if (!isFullscreen) return;
    closeBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCloseFullscreen();
      } else if (e.key === "+" || e.key === "=") {
        handleZoomIn();
      } else if (e.key === "-") {
        handleZoomOut();
      } else if (e.key === "0" || e.key === "r" || e.key === "R") {
        handleReset();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, handleCloseFullscreen, handleZoomIn, handleZoomOut, handleReset]);

  if (error) {
    return (
      <div className="not-prose my-4 p-4 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs font-mono">
        <p className="font-bold mb-1">Erreur de rendu Mermaid :</p>
        <pre className="whitespace-pre-wrap">{error}</pre>
      </div>
    );
  }

  return (
    <figure className="not-prose my-6 rounded-lg border border-slate-200 dark:border-[#22262f] bg-slate-50/50 dark:bg-[#12151b] overflow-hidden">
      <figcaption className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-[#22262f] flex justify-between items-center">
        <span>{title || "Diagramme"}</span>
        <button
          type="button"
          onClick={handleOpenFullscreen}
          className="text-xs px-2.5 py-1 rounded bg-slate-200/80 dark:bg-[#22262f] hover:bg-slate-300 dark:hover:bg-[#373a41] text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5 font-medium shadow-sm"
          title="Ouvrir le diagramme en plein écran"
        >
          <span>Plein écran</span>
          <span>⛶</span>
        </button>
      </figcaption>

      <div
        ref={containerRef}
        className="p-4 overflow-x-auto flex justify-center items-center min-h-[140px] [&_svg]:max-w-full [&_svg]:h-auto"
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      {caption && (
        <div className="px-4 py-2 text-xs text-center text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-[#22262f]">
          {caption}
        </div>
      )}

      {isFullscreen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-slate-900/90 dark:bg-slate-950/95 backdrop-blur-md flex flex-col select-none"
            role="dialog"
            aria-modal="true"
            aria-label={title || "Diagramme en plein écran"}
          >
            {/* Barre d'outils supérieure */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#12151b]/95 text-slate-800 dark:text-slate-200 z-10 shadow-lg backdrop-blur">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-sm text-slate-900 dark:text-white">
                  {title || "Explorateur de Diagramme"}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-800 font-mono">
                  {Math.round(zoom * 100)}%
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
                  (Molette pour zoomer • Glisser pour déplacer)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-sm font-bold transition-colors border border-slate-300 dark:border-slate-700"
                  title="Zoom Avant (+)"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-sm font-bold transition-colors border border-slate-300 dark:border-slate-700"
                  title="Zoom Arrière (-)"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors border border-slate-300 dark:border-slate-700"
                  title="Réinitialiser (R ou 0)"
                >
                  Recadrer
                </button>
                <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />
                <button
                  ref={closeBtnRef}
                  type="button"
                  onClick={handleCloseFullscreen}
                  className="px-3.5 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow"
                  title="Fermer (Échap)"
                >
                  <span>Fermer</span>
                  <span>✕</span>
                </button>
              </div>
            </div>

            {/* Zone de navigation interactive (Canvas Pan & Zoom) */}
            <div
              ref={viewportRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={`flex-1 w-full h-full overflow-hidden relative flex items-center justify-center touch-none select-none ${
                isDragging ? "cursor-grabbing" : "cursor-grab"
              }`}
            >
              <div
                style={{
                  transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                  transformOrigin: "center center",
                  transition: isDragging ? "none" : "transform 0.08s ease-out",
                  width: nativeDimensions?.width ? `${nativeDimensions.width}px` : "100%",
                  height: nativeDimensions?.height ? `${nativeDimensions.height}px` : "auto",
                  maxWidth: "none",
                  maxHeight: "none",
                }}
                className="shrink-0 pointer-events-none select-none flex items-center justify-center [&_svg]:w-full [&_svg]:h-full [&_svg]:max-w-none [&_svg]:block"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            </div>
          </div>,
          document.body
        )}
    </figure>
  );
}
