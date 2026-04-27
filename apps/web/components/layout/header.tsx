'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { Menu, X, Search, ChevronDown, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';

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

const navigation: NavItem[] = [
  {
    name: 'Parlementaires',
    items: [
      { name: 'Groupes politiques', href: '/groupes' },
      { name: 'Députés', href: '/deputes' },
      { name: 'Sénateurs', href: '/senateurs' },
      { name: 'Commissions', href: '/commissions' },
    ],
  },
  {
    name: 'Activité',
    items: [
      { name: 'Sujets parlementaires', href: '/sujets' },
      { name: 'Dossiers législatifs', href: '/dossiers' },
      { name: 'Scrutins', href: '/scrutins' },
      { name: 'Agenda parlementaire', href: '/agenda' },
    ],
  },
  { name: 'Lobbying', href: '/lobbying' },
  {
    name: 'Outils',
    items: [
      { name: 'Comprendre', href: '/comprendre' },
      { name: 'Guide pratique', href: '/guide' },
      { name: 'Classements', href: '/classements' },
      { name: 'Comparer des députés', href: '/deputes?compare=true' },
      { name: 'Comparer des sénateurs', href: '/senateurs?compare=true' },
    ],
  },
];

// ── Desktop Dropdown ──

function NavDropdown({ item }: { item: NavItem & { items: DropdownItem[] } }) {
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
                <NavDropdown key={item.name} item={item as NavItem & { items: DropdownItem[] }} />
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
              className="inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <span className="sr-only">Ouvrir le menu</span>
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
