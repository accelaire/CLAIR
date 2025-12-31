import Link from 'next/link';
import { Github, Twitter } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="text-2xl font-bold text-primary">
              CLAIR
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              Plateforme citoyenne de transparence politique.
              Données 100% publiques, 0% d&apos;opinion.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="font-semibold">Explorer</h3>
            <ul className="mt-4 space-y-2">
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
              <li>
                <Link href="/explorateur" className="text-sm text-muted-foreground hover:text-foreground">
                  Explorateur
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-semibold">Ressources</h3>
            <ul className="mt-4 space-y-2">
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
                <Link href="/api" className="text-sm text-muted-foreground hover:text-foreground">
                  API
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold">Légal</h3>
            <ul className="mt-4 space-y-2">
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
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 md:flex-row">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} CLAIR. Données sources :{' '}
            <a
              href="https://data.assemblee-nationale.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Assemblée nationale
            </a>
            ,{' '}
            <a
              href="https://data.senat.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Sénat
            </a>
            ,{' '}
            <a
              href="https://www.hatvp.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              HATVP
            </a>
            ,{' '}
            <a
              href="https://echanges.dila.gouv.fr/OPENDATA"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              DILA
            </a>
          </p>

          <div className="flex items-center space-x-4">
            <a
              href="https://github.com/clair-politique"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
              aria-label="GitHub"
            >
              <Github className="h-5 w-5" />
            </a>
            <a
              href="https://twitter.com/clair_politique"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
              aria-label="Twitter"
            >
              <Twitter className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
