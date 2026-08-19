'use client';

import Link from 'next/link';

export interface Pastille {
  cle: string;
  label: string;
  /** Phrase de survol : ce que la pastille montre. */
  aide?: string;
  /** Renseignée, la pastille devient un lien ; sinon elle appelle `onSelect`. */
  href?: string;
}

/**
 * Bande de pastilles horizontale, partagée par la page mère et les pages de
 * graphique.
 *
 * Un seul composant pour les deux, parce que ce sont les mêmes choix : sur la
 * page mère ils changent le tri et le graphique affiché, sur une page de
 * graphique ils changent de page. Deux composants distincts auraient fini par
 * diverger — un libellé retouché d'un côté, un espacement de l'autre — et le
 * lecteur qui passe de l'une à l'autre aurait cru changer d'outil.
 */
export function PastillesLecture({
  titre,
  pastilles,
  actif,
  onSelect,
}: {
  titre: string;
  pastilles: Pastille[];
  actif: string;
  onSelect?: (cle: string) => void;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">{titre}</h2>
      {/* `-mx-4 px-4` sur petit écran : les pastilles défilent d'un bord à
          l'autre au lieu de s'arrêter sur la marge du conteneur, ce qui rendait
          le débordement invisible. */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {pastilles.map((pastille) => {
          const selectionne = actif === pastille.cle;
          const classes = `shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
            selectionne
              ? 'border-primary bg-primary font-medium text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`;

          if (pastille.href) {
            return selectionne ? (
              // La pastille courante ne se lie pas à elle-même : un lien qui
              // recharge la page qu'on regarde n'apporte rien et brouille la
              // navigation au clavier.
              <span key={pastille.cle} aria-current="page" className={classes}>
                {pastille.label}
              </span>
            ) : (
              <Link
                key={pastille.cle}
                href={pastille.href}
                title={pastille.aide}
                className={classes}
              >
                {pastille.label}
              </Link>
            );
          }

          return (
            <button
              key={pastille.cle}
              type="button"
              onClick={() => onSelect?.(pastille.cle)}
              title={pastille.aide}
              aria-pressed={selectionne}
              className={classes}
            >
              {pastille.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
