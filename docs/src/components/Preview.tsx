import { cssVariablesResolver, theme } from "@clair/theme";
import { type Navigation, NavigationProvider, type RouterLinkProps } from "@clair/ui";
import { MantineProvider, mergeThemeOverrides } from "@mantine/core";
import { type ReactNode, useMemo, useState, useSyncExternalStore } from "react";
import "./preview.css";

type PreviewProps = {
  children: ReactNode;
  /** Fond de page de l'application plutôt que fond de surface. */
  surface?: "page" | "surface";
};

/** Dans un aperçu, les liens et la navigation ne quittent pas la page de documentation. */
const PreviewLink = ({ href, onClick, ...props }: RouterLinkProps) => (
  <a
    href={href}
    {...props}
    onClick={(event) => {
      event.preventDefault();
      onClick?.(event);
    }}
  />
);

const previewNavigation: Navigation = { Link: PreviewLink, navigate: () => {}, pathname: "/" };

/** Thème de la documentation (classe `dark` posée par Zudoku sur `<html>`). */
const subscribe = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
};
const isDark = () => document.documentElement.classList.contains("dark");

/**
 * Aperçu en direct d'un composant de @clair/ui, avec le thème de l'application et le mode
 * (clair / sombre) de la documentation. Les variables Mantine sont limitées au cadre
 * `.clair-preview` : l'aperçu ne modifie pas le style de la documentation. Les éléments que Mantine
 * rend dans un portail (bulle d'aide, listes déroulantes, calendriers) le sont dans ce cadre, hors
 * de la zone qui défile : sinon ils sortiraient du thème de l'aperçu (mode sombre perdu).
 */
export const Preview = ({ children, surface = "surface" }: PreviewProps) => {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  const scheme = dark ? "dark" : "light";
  const [portails, setPortails] = useState<HTMLDivElement | null>(null);
  const themeApercu = useMemo(
    () =>
      portails
        ? mergeThemeOverrides(theme, {
            components: { Portal: { defaultProps: { target: portails } } },
          })
        : theme,
    [portails],
  );
  return (
    <div className="clair-preview not-prose" data-mantine-color-scheme={scheme} data-surface={surface}>
      <MantineProvider
        theme={themeApercu}
        cssVariablesResolver={cssVariablesResolver}
        forceColorScheme={scheme}
        cssVariablesSelector=".clair-preview"
        getRootElement={() => undefined}
      >
        <div className="clair-preview-contenu">
          <NavigationProvider value={previewNavigation}>{children}</NavigationProvider>
        </div>
        <div ref={setPortails} className="clair-preview-portails" />
      </MantineProvider>
    </div>
  );
};
