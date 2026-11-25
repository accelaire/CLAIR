'use client';

// Le texte entier d'une pétition, replié au-delà de quelques paragraphes.
//
// Tout le texte est dans le HTML servi (lu par les moteurs et les lecteurs
// d'écran) : le repli n'est qu'une hauteur maximale, sans mesure côté client,
// donc sans écart entre rendu serveur et hydratation.

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/** Au-delà, le texte est replié. */
const LONGUEUR_REPLIEE = 1_400;

export function TextePetition({ texte }: { texte: string }) {
  const long = texte.length > LONGUEUR_REPLIEE;
  const [ouvert, setOuvert] = useState(false);
  const replie = long && !ouvert;

  return (
    <div>
      <div className={`relative ${replie ? 'max-h-80 overflow-hidden' : ''}`}>
        <div className="space-y-3 text-sm leading-relaxed">
          {texte.split('\n\n').map((paragraphe, i) => (
            <p key={i} className="whitespace-pre-line">
              {paragraphe}
            </p>
          ))}
        </div>
        {replie && (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-card to-transparent" />
        )}
      </div>
      {long && (
        <button
          type="button"
          onClick={() => setOuvert(!ouvert)}
          aria-expanded={ouvert}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {ouvert ? 'Réduire le texte' : 'Lire tout le texte'}
          <ChevronDown className={`h-4 w-4 transition-transform ${ouvert ? 'rotate-180' : ''}`} aria-hidden />
        </button>
      )}
    </div>
  );
}
