"use client";

import {
  type AnchorHTMLAttributes,
  type ComponentType,
  createContext,
  type ReactNode,
  useContext,
} from "react";

export type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/**
 * Adaptateur de routage. Les composants et les écrans ne connaissent pas Next.js :
 * l'application fournit son composant de lien et sa fonction de navigation.
 */
export type Navigation = {
  Link: ComponentType<LinkProps>;
  navigate: (href: string) => void;
  /**
   * Remplace l'adresse courante sans ajouter d'entrée à l'historique (une ancre d'un ancien
   * lien traduite en paramètre, par exemple). Absente : `navigate`.
   */
  replace?: (href: string) => void;
  pathname: string;
};

const defaultNavigation: Navigation = {
  Link: (props) => <a {...props} />,
  navigate: (href) => window.location.assign(href),
  replace: (href) => window.location.replace(href),
  pathname: "/",
};

const NavigationContext = createContext<Navigation>(defaultNavigation);

export const NavigationProvider = ({
  value,
  children,
}: {
  value: Navigation;
  children: ReactNode;
}) => <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;

/** Lien, navigation et chemin courant fournis par l'application. */
export const useNavigation = () => useContext(NavigationContext);
