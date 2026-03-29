import Link from 'next/link';
import { Github, Twitter } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        {/* Brand */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/" className="text-2xl font-bold text-primary">
              CLAIR
            </Link>
            <p className="mt-2 text-sm text-muted-foreground max-w-xs">
              Plateforme citoyenne de transparence politique.
              Données 100% publiques, 0% d&apos;opinion.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/accelaire/CLAIR"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="GitHub"
            >
              <Github className="h-4 w-4" />
            </a>
            <a
              href="https://x.com/ClairPolitique"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="X (Twitter)"
            >
              <Twitter className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Link columns — always 3-col, even on mobile */}
        <div className="mt-8 grid grid-cols-3 gap-4 md:gap-8">
          {/* Navigation */}
          <div>
            <h3 className="text-sm font-semibold">Explorer</h3>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/deputes" className="text-sm text-muted-foreground hover:text-foreground">
                  Députés
                </Link>
              </li>
              <li>
                <Link href="/senateurs" className="text-sm text-muted-foreground hover:text-foreground">
                  Sénateurs
                </Link>
              </li>
              <li>
                <Link href="/scrutins" className="text-sm text-muted-foreground hover:text-foreground">
                  Scrutins
                </Link>
              </li>
              <li>
                <Link href="/lobbying" className="text-sm text-muted-foreground hover:text-foreground">
                  Lobbying
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-semibold">Ressources</h3>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/a-propos" className="text-sm text-muted-foreground hover:text-foreground">
                  À propos
                </Link>
              </li>
              <li>
                <Link href="/methodologie" className="text-sm text-muted-foreground hover:text-foreground">
                  Méthodologie
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/comprendre" className="text-sm text-muted-foreground hover:text-foreground">
                  Comprendre
                </Link>
              </li>
              <li>
                <Link href="/guide" className="text-sm text-muted-foreground hover:text-foreground">
                  Guide pratique
                </Link>
              </li>
              <li>
                <a
                  href={`${API_URL}/docs`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  API Documentation
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold">Légal</h3>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/mentions-legales" className="text-sm text-muted-foreground hover:text-foreground">
                  Mentions légales
                </Link>
              </li>
              <li>
                <Link href="/confidentialite" className="text-sm text-muted-foreground hover:text-foreground">
                  Confidentialité
                </Link>
              </li>
              <li>
                <Link href="/cgu" className="text-sm text-muted-foreground hover:text-foreground">
                  CGU
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-8 border-t pt-6">
          <p className="text-xs text-muted-foreground text-center md:text-left">
            © {new Date().getFullYear()} CLAIR. Sources :{' '}
            <a href="https://data.assemblee-nationale.fr" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">AN</a>
            {' · '}
            <a href="https://data.senat.fr" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Sénat</a>
            {' · '}
            <a href="https://www.hatvp.fr" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">HATVP</a>
            {' · '}
            <a href="https://echanges.dila.gouv.fr/OPENDATA" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">DILA</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
