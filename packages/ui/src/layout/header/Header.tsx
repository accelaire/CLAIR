"use client";

import { Burger, Drawer } from "@mantine/core";
import { useClickOutside, useDisclosure, useWindowEvent } from "@mantine/hooks";
import { ChevronDown, Search } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Link } from "../../core/link/Link.tsx";
import { ThemeToggle } from "../../core/theme-toggle/ThemeToggle.tsx";
import { useNavigation } from "../../lib/navigation.tsx";
import classes from "./Header.module.css";

export type NavLinkItem = { label: string; href: string };
export type NavItem = NavLinkItem | { label: string; items: NavLinkItem[] };

export type HeaderProps = {
  /** Rubriques du menu : un lien, ou un groupe de liens ouvert dans un menu déroulant. */
  navigation: NavItem[];
  /** Lien de recherche (icône). */
  searchHref?: string;
  /** Appel à l'action à droite (« Nous soutenir »). */
  cta?: NavLinkItem;
  /** Logo ou nom du site, lien vers l'accueil. */
  brand?: ReactNode;
  /** Nom accessible du lien de la marque (il doit contenir le texte visible). */
  brandLabel?: string;
};

const isGroup = (item: NavItem): item is { label: string; items: NavLinkItem[] } => "items" in item;

/** Page courante ou l'une de ses sous-pages. */
const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

/**
 * Rubrique de navigation : motif « disclosure » du W3C (bouton `aria-expanded` + liste de
 * liens), recommandé pour la navigation d'un site plutôt que `role="menu"`.
 * Se ferme par Échap, par un clic à l'extérieur, en la quittant au clavier ou en suivant un lien.
 */
const NavGroup = ({
  group,
  pathname,
}: {
  group: { label: string; items: NavLinkItem[] };
  pathname: string;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const button = useRef<HTMLButtonElement>(null);
  const { Link: RouterLink } = useNavigation();
  // Identifiant stable et unique, même avec des accents dans le libellé (« Données »).
  const id = `rubrique-${useId().replace(/:/g, "")}`;
  // Quitter la rubrique au clavier (Tab) la referme, comme un clic à l'extérieur.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onFocusOut = (event: FocusEvent) => {
      if (!(event.relatedTarget instanceof Node && node.contains(event.relatedTarget))) {
        setOpen(false);
      }
    };
    node.addEventListener("focusout", onFocusOut);
    return () => node.removeEventListener("focusout", onFocusOut);
  }, [ref]);
  useWindowEvent("keydown", (event) => {
    if (open && event.key === "Escape") {
      setOpen(false);
      button.current?.focus();
    }
  });
  return (
    <div ref={ref} className={classes.group}>
      <button
        ref={button}
        type="button"
        className={classes.navItem}
        aria-expanded={open}
        aria-controls={id}
        data-active={group.items.some((sub) => isActive(pathname, sub.href)) || undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {group.label}
        <ChevronDown className={classes.chevron} aria-hidden="true" />
      </button>
      <ul id={id} className={classes.dropdown} hidden={!open}>
        {group.items.map((sub) => (
          <li key={sub.href}>
            <RouterLink
              href={sub.href}
              className={classes.dropdownLink}
              aria-current={isActive(pathname, sub.href) ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {sub.label}
            </RouterLink>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * En-tête du site : marque, rubriques (menus déroulants accessibles au clavier), recherche,
 * thème, appel à l'action ; sur mobile, la navigation passe dans un tiroir.
 */
export const Header = ({
  navigation,
  searchHref = "/recherche",
  cta,
  brand = "CLAIR",
  brandLabel = "CLAIR, accueil",
}: HeaderProps) => {
  const { pathname, Link: RouterLink } = useNavigation();
  const [opened, { toggle, close }] = useDisclosure(false);

  return (
    <header className={classes.header}>
      <div className={classes.inner}>
        <RouterLink href="/" className={classes.brand} aria-label={brandLabel}>
          {brand}
        </RouterLink>

        <nav className={classes.desktopNav} aria-label="Navigation principale">
          <ul className={classes.list}>
            {navigation.map((item) =>
              isGroup(item) ? (
                <li key={item.label}>
                  <NavGroup group={item} pathname={pathname} />
                </li>
              ) : (
                <li key={item.href}>
                  <RouterLink
                    href={item.href}
                    className={classes.navItem}
                    aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  >
                    {item.label}
                  </RouterLink>
                </li>
              ),
            )}
          </ul>
        </nav>

        <div className={classes.actions}>
          <RouterLink href={searchHref} className={classes.iconLink} aria-label="Rechercher">
            <Search aria-hidden="true" />
          </RouterLink>
          <ThemeToggle />
          {cta ? (
            <RouterLink href={cta.href} className={classes.cta}>
              {cta.label}
            </RouterLink>
          ) : null}
          <Burger
            className={classes.burger}
            opened={opened}
            onClick={toggle}
            size="sm"
            aria-label={opened ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={opened}
          />
        </div>
      </div>

      <Drawer opened={opened} onClose={close} title="Menu" position="right" size="xs">
        <nav aria-label="Navigation principale (mobile)">
          {navigation.map((item) =>
            isGroup(item) ? (
              <div key={item.label} className={classes.drawerGroup}>
                <p className={classes.drawerTitle}>{item.label}</p>
                {item.items.map((sub) => (
                  <Link
                    key={sub.href}
                    href={sub.href}
                    className={classes.drawerLink}
                    aria-current={isActive(pathname, sub.href) ? "page" : undefined}
                    onClick={close}
                  >
                    {sub.label}
                  </Link>
                ))}
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={classes.drawerLink}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                onClick={close}
              >
                {item.label}
              </Link>
            ),
          )}
          {cta ? (
            <Link href={cta.href} className={classes.drawerLink} onClick={close}>
              {cta.label}
            </Link>
          ) : null}
        </nav>
      </Drawer>
    </header>
  );
};
