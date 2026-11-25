'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { Menu, X, Search, ChevronDown, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useNouveautesNonVues } from '@/hooks/useNouveautesNonVues';

/** Section récente pas encore ouverte (cf. `lib/nouveautes`), sur le modèle du badge « bientôt ». */
function BadgeNouveau() {
  return <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">nouveau</span>;
}

interface DropdownItem {
  name: string;
  href: string;
  soon?: boolean;
}

interface NavItem {
  name: string;
  href?: string;
  items?: DropdownItem[];
}

// Organisé par rôle : qui décide, ce qui se décide, les élections, l'influence,
// puis les outils. « Parlementaires » ne pouvait pas contenir les gouvernements
// (leurs membres ne sont pas tous élus) ni les élections.
const navigation: NavItem[] = [
  {
    name: 'Qui décide',
    items: [
      { name: 'Députés', href: '/deputes' },
      { name: 'Sénateurs', href: '/senateurs' },
      { name: 'Gouvernements', href: '/gouvernements' },
      { name: 'Groupes politiques', href: '/groupes' },
      { name: 'Commissions', href: '/commissions' },
    ],
  },
  {
    name: 'Lois et votes',
    items: [
      { name: 'Sujets', href: '/sujets' },
      { name: 'Dossiers législatifs', href: '/dossiers' },
      { name: 'Scrutins', href: '/scrutins' },
      { name: 'Pétitions', href: '/petitions' },
      { name: 'Agenda', href: '/agenda' },
    ],
  },
  {
    name: 'Élections',
    items: [{ name: 'Sénatoriales 2026', href: '/senatoriales-2026' }],
  },
  { name: 'Lobbying', href: '/lobbying' },
  {
    name: 'Outils',
    items: [
      { name: 'Classements', href: '/classements' },
      { name: 'Comparer des députés', href: '/deputes?compare=true' },
      { name: 'Comparer des sénateurs', href: '/senateurs?compare=true' },
      { name: 'Comprendre', href: '/comprendre' },
      { name: 'Guide pratique', href: '/guide' },
    ],
  },
];

// ── Desktop Dropdown ──

function NavDropdown({ item, nonVue }: { item: NavItem & { items: DropdownItem[] }; nonVue: (chemin: string) => boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {item.name}
        {/* Un point discret signale qu'une section du menu est nouvelle. */}
        {item.items.some((sub) => nonVue(sub.href)) && (
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
        )}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 min-w-[200px] rounded-lg border bg-popover p-1 shadow-lg">
          {item.items.map((sub) => (
            <Link
              key={sub.href}
              href={sub.href}
              onClick={() => setOpen(false)}
              className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                sub.soon
                  ? 'text-muted-foreground/50 pointer-events-none'
                  : 'text-foreground hover:bg-accent'
              }`}
            >
              {sub.name}
              {nonVue(sub.href) && <BadgeNouveau />}
              {sub.soon && (
                <span className="ml-2 text-[10px] font-medium text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">
                  bientôt
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Header ──

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      aria-label="Basculer le mode sombre"
    >
      <Sun className="h-5 w-5 hidden dark:block" />
      <Moon className="h-5 w-5 block dark:hidden" />
    </button>
  );
}

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const nonVue = useNouveautesNonVues();
  const nouveauteNonVue = navigation.some((item) => item.items?.some((sub) => nonVue(sub.href)));

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-2xl font-bold text-primary">CLAIR</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-6">
            {navigation.map((item) =>
              item.items ? (
                <NavDropdown key={item.name} item={item as NavItem & { items: DropdownItem[] }} nonVue={nonVue} />
              ) : (
                <Link
                  key={item.name}
                  href={item.href!}
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.name}
                </Link>
              )
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-3">
            <Link
              href="/recherche"
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Rechercher"
            >
              <Search className="h-5 w-5" />
            </Link>
            <ThemeToggle />
            <Link
              href="/soutenir"
              className="hidden sm:inline-flex items-center rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-1.5 text-sm font-medium transition-colors"
            >
              Nous soutenir
            </Link>

            {/* Mobile menu button */}
            <button
              type="button"
              className="relative inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <span className="sr-only">Ouvrir le menu</span>
              {/* Le même point que sur les menus déroulants de l'ordinateur. */}
              {nouveauteNonVue && !mobileMenuOpen && (
                <span aria-hidden className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
              )}
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="border-t py-4 md:hidden">
            <div className="flex flex-col space-y-1">
              {navigation.map((item) =>
                item.items ? (
                  <div key={item.name}>
                    <div className="px-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {item.name}
                    </div>
                    {item.items.map((sub) => (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        className={`block px-4 py-2 text-base font-medium transition-colors ${
                          sub.soon
                            ? 'text-muted-foreground/50'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => !sub.soon && setMobileMenuOpen(false)}
                      >
                        {sub.name}
                        {nonVue(sub.href) && <BadgeNouveau />}
                        {sub.soon && (
                          <span className="ml-2 text-[10px] bg-muted px-1.5 py-0.5 rounded">bientôt</span>
                        )}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Link
                    key={item.name}
                    href={item.href!}
                    className="block px-2 py-2 text-base font-medium text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.name}
                  </Link>
                )
              )}
              <Link
                href="/soutenir"
                className="block px-2 py-2 text-base font-medium text-primary transition-colors hover:text-primary/80"
                onClick={() => setMobileMenuOpen(false)}
              >
                Nous soutenir
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
