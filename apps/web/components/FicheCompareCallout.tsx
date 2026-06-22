'use client';

import Link from 'next/link';
import { BarChart3, GitCompareArrows, ArrowRight, type LucideIcon } from 'lucide-react';

type Variant = 'parlementaire' | 'groupe';

interface FicheCompareCalloutProps {
  /** Type de fiche : un parlementaire propose 2 actions, un groupe une seule. */
  variant: Variant;
  chambre: 'assemblee' | 'senat';
  /** Slug du parlementaire ou du groupe, utilisé pour le deep-link + highlight. */
  slug: string;
  className?: string;
}

interface CalloutAction {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

/**
 * Bloc « Aller plus loin » posé sous les statistiques individuelles d'une fiche.
 * Regroupe les actions de mise en perspective (rang dans le classement, et
 * comparaison tête-à-tête pour les parlementaires) pour rendre /classements
 * découvrable depuis le contexte où l'utilisateur consulte une stat unitaire.
 *
 * Le lien classement ne porte que `highlight=<slug>` : la page /classements
 * résout elle-même le rang (via l'endpoint /parlementaires/:slug/rank) pour
 * sauter sur la bonne page et surligner la ligne.
 */
export function FicheCompareCallout({ variant, chambre, slug, className = '' }: FicheCompareCalloutProps) {
  const route = chambre === 'assemblee' ? 'deputes' : 'senateurs';
  const membreLabel = chambre === 'assemblee' ? 'député' : 'sénateur';

  const actions: CalloutAction[] =
    variant === 'parlementaire'
      ? [
          {
            href: `/classements?tab=parlementaires&chambre=${chambre}&highlight=${slug}`,
            icon: BarChart3,
            title: 'Voir son rang dans le classement',
            description: 'Présence, loyauté, interventions, amendements face aux autres élus.',
          },
          {
            href: `/${route}?compare=${slug}`,
            icon: GitCompareArrows,
            title: `Comparer avec un autre ${membreLabel}`,
            description: 'Mettez deux parcours côte à côte, indicateur par indicateur.',
          },
        ]
      : [
          {
            href: `/classements?tab=groupes&chambre=${chambre}&highlight=${slug}`,
            icon: BarChart3,
            title: 'Voir son rang dans le classement des groupes',
            description: 'Présence, loyauté et cohésion face aux autres groupes.',
          },
        ];

  return (
    <section className={`mb-8 rounded-xl border bg-card p-2 ${className}`}>
      <p className="px-2 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Aller plus loin
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        {actions.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-1 items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold transition-colors group-hover:text-primary">{title}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        ))}
      </div>
    </section>
  );
}
