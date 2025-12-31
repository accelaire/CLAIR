'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X, Search, Heart } from 'lucide-react';

const navigation = [
  { name: 'Députés', href: '/deputes' },
  { name: 'Sénateurs', href: '/senateurs' },
  { name: 'Scrutins', href: '/scrutins' },
  { name: 'Lobbying', href: '/lobbying' },
  { name: 'Explorateur', href: '/explorateur', badge: 'Beta' },
  // { name: 'Simulateur 2027', href: '/simulateur' }, // TODO: Activer quand les programmes seront sortis
];

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
          <div className="hidden md:flex md:items-center md:space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground flex items-center gap-1.5"
              >
                {item.name}
                {item.badge && (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-primary/10 text-primary">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-4">
            <Link
              href="/soutenir"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 text-sm font-medium transition-colors"
            >
              <Heart className="h-4 w-4" />
              Soutenir
            </Link>
            <Link
              href="/recherche"
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Rechercher"
            >
              <Search className="h-5 w-5" />
            </Link>

            {/* TODO: Activer quand l'auth sera implémentée
            <Link
              href="/connexion"
              className="hidden items-center space-x-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent sm:inline-flex"
            >
              <User className="h-4 w-4" />
              <span>Connexion</span>
            </Link>
            */}

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
            <div className="flex flex-col space-y-4">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="text-base font-medium text-muted-foreground transition-colors hover:text-foreground flex items-center gap-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                  {item.badge && (
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-primary/10 text-primary">
                      {item.badge}
                    </span>
                  )}
                </Link>
              ))}
              <Link
                href="/soutenir"
                className="inline-flex items-center gap-2 text-base font-medium text-red-500 transition-colors hover:text-red-600"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Heart className="h-4 w-4" />
                Soutenir CLAIR
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
