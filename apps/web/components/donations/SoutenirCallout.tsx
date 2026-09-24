import Link from 'next/link';
import { Heart, ArrowRight } from 'lucide-react';

interface SoutenirCalloutProps {
  /**
   * Marge haute. Les pages qui referment déjà une section avec sa propre marge
   * passent `false` pour ne pas doubler l'espace.
   */
  spaced?: boolean;
  className?: string;
}

/**
 * L'appel au don, en pied de contenu des pages qui reçoivent le trafic.
 *
 * Il existe parce que le tunnel mesuré en septembre 2026 était vide : sur
 * 1 100 visiteurs mensuels, 6 atteignaient `/soutenir`. Le lien ne vivait que
 * dans le header desktop, au fond du menu burger et tout en bas de l'accueil,
 * alors que la profondeur de scroll médiane de l'accueil est de 31 % et que la
 * quasi-totalité du trafic arrive par une recherche Google sur une fiche, sans
 * jamais voir l'accueil. La demande doit donc être là où les gens atterrissent.
 *
 * Volontairement sobre : il apparaît sur des centaines de pages, et un bloc
 * coloré à chaque fiche transformerait un projet de transparence en site qui
 * quémande. Le seul argument mis en avant est celui qui est à la fois factuel
 * et décisif, la déduction fiscale de 66 %.
 */
export function SoutenirCallout({ spaced = true, className = '' }: SoutenirCalloutProps) {
  return (
    <aside
      className={`${spaced ? 'mt-12' : ''} rounded-xl border bg-muted/30 p-5 ${className}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Heart className="hidden h-5 w-5 shrink-0 text-red-500 sm:block" aria-hidden />
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            Cette page est gratuite, sans publicité et sans financement politique.
          </span>{' '}
          CLAIR est une association d&apos;intérêt général : un don de
          10&nbsp;€ vous revient à 3,40&nbsp;€ après déduction fiscale.
        </p>
        <Link
          href="/soutenir"
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
        >
          Soutenir CLAIR
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </aside>
  );
}
