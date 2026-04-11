import type { Metadata } from 'next';
import Link from 'next/link';
import {
  User,
  Search,
  GitCompareArrows,
  Briefcase,
  Vote,
  ArrowRight,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Guide pratique',
  description:
    'Parcours guidés pour tirer le maximum de CLAIR : découvrir votre député, suivre un sujet, comparer des élus, explorer le lobbying.',
};

const parcours = [
  {
    title: 'Découvrir mon député',
    icon: User,
    href: '/guide/decouvrir-mon-depute',
    description: 'Trouver votre député et comprendre son activité',
  },
  {
    title: 'Suivre un sujet',
    icon: Search,
    href: '/guide/suivre-un-sujet',
    description: 'Rechercher un thème et suivre les votes associés',
  },
  {
    title: 'Comparer des élus',
    icon: GitCompareArrows,
    href: '/guide/comparer-des-elus',
    description: 'Mettre en regard l\u2019activité de deux parlementaires',
  },
  {
    title: 'Comprendre le lobbying',
    icon: Briefcase,
    href: '/guide/comprendre-le-lobbying',
    description: 'Explorer les représentants d\u2019intérêts et leurs actions',
  },
  {
    title: 'Décrypter un scrutin',
    icon: Vote,
    href: '/guide/decrypter-un-scrutin',
    description: 'Lire et analyser un vote parlementaire',
  },
];

export default function GuidePage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Guide pratique
        </h1>
        <p className="mt-6 text-lg text-muted-foreground">
          Parcours guidés pour tirer le maximum de CLAIR. Choisissez un parcours
          et laissez-vous guider étape par étape.
        </p>
      </div>

      <div className="mx-auto mt-12 max-w-4xl">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {parcours.map((p) => {
            const Icon = p.icon;
            return (
              <Link
                key={p.href}
                href={p.href}
                className="group rounded-lg border bg-card p-6 transition-all hover:border-primary hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                </div>
                <h2 className="mt-4 font-semibold">{p.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {p.description}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-4xl text-center">
        <p className="text-muted-foreground">
          Vous souhaitez comprendre les institutions ?{' '}
          <Link href="/comprendre" className="text-primary hover:underline">
            Consultez nos pages pédagogiques
          </Link>
        </p>
      </div>
    </div>
  );
}
