// Un texte venu d'une source (libellé d'une étape, réponse officielle) :
// paragraphes séparés par une ligne vide, retours simples gardés, liens
// `[texte](url)` et adresses nues rendus cliquables. Les parlementaires et
// membres du Gouvernement que l'API a su résoudre (`renvois`) mènent à leur
// fiche sur CLAIR plutôt qu'au site de la chambre.

import Link from 'next/link';
import { morceauxDeTexte, type RenvoiPersonne } from '@/lib/petitions';

export function TexteSource({
  texte,
  renvois = [],
  className = '',
}: {
  texte: string;
  renvois?: readonly RenvoiPersonne[];
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {texte.split(/\n{2,}/).map((paragraphe, i) => (
        <p key={i} className="whitespace-pre-line">
          {morceauxDeTexte(paragraphe, renvois).map((m, j) =>
            !m.href ? (
              <span key={j}>{m.texte}</span>
            ) : m.interne ? (
              <Link key={j} href={m.href} className="font-medium text-primary underline-offset-2 hover:underline">
                {m.texte}
              </Link>
            ) : (
              <a
                key={j}
                href={m.href}
                target="_blank"
                rel="noopener noreferrer"
                className="break-words text-primary underline-offset-2 hover:underline"
              >
                {m.texte}
              </a>
            ),
          )}
        </p>
      ))}
    </div>
  );
}
