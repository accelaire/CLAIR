import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Landmark,
  User,
  Vote,
  FileText,
  Users,
  Briefcase,
  Building,
  ArrowRight,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Comprendre la politique française | CLAIR',
  description:
    'Découvrez le fonctionnement des institutions démocratiques françaises : Parlement, scrutins, dossiers législatifs, groupes politiques, lobbying et commissions.',
};

const topics = [
  {
    title: 'Le Parlement',
    icon: Landmark,
    href: '/comprendre/parlement',
    description: 'Assemblée et Sénat : deux chambres, un Parlement',
  },
  {
    title: 'Le parlementaire',
    icon: User,
    href: '/comprendre/parlementaire',
    description: 'Mandat, circonscription, groupe politique, statistiques',
  },
  {
    title: 'Le scrutin',
    icon: Vote,
    href: '/comprendre/scrutin',
    description: 'Comment se déroule un vote et comment lire le résultat',
  },
  {
    title: 'Le dossier législatif',
    icon: FileText,
    href: '/comprendre/dossier-legislatif',
    description: 'De la proposition de loi à la promulgation',
  },
  {
    title: 'Les groupes politiques',
    icon: Users,
    href: '/comprendre/groupes-politiques',
    description: 'Parti vs groupe, cohésion, alliances',
  },
  {
    title: 'Le lobbying',
    icon: Briefcase,
    href: '/comprendre/lobbying',
    description: 'HATVP, déclarations, secteurs d\u2019activité',
  },
  {
    title: 'Les commissions',
    icon: Building,
    href: '/comprendre/commissions',
    description: 'Le travail législatif en coulisses',
  },
];

export default function ComprendrePage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Comprendre la politique française
        </h1>
        <p className="mt-6 text-lg text-muted-foreground">
          Comment fonctionne le Parlement ? Qu&apos;est-ce qu&apos;un scrutin public ?
          Cette section vous aide à comprendre les institutions démocratiques françaises,
          simplement et sans jargon.
        </p>
      </div>

      <div className="mx-auto mt-12 max-w-4xl">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((topic) => {
            const Icon = topic.icon;
            return (
              <Link
                key={topic.href}
                href={topic.href}
                className="group rounded-lg border bg-card p-6 transition-all hover:border-primary hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                </div>
                <h2 className="mt-4 font-semibold">{topic.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {topic.description}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-4xl text-center">
        <p className="text-muted-foreground">
          Vous cherchez un parcours guidé pour utiliser CLAIR ?{' '}
          <Link href="/guide" className="text-primary hover:underline">
            Découvrir le guide pratique
          </Link>
        </p>
      </div>
    </div>
  );
}
