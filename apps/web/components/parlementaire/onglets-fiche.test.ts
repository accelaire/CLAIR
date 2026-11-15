import { describe, expect, it } from 'vitest';
import { ongletsVisibles } from './onglets-fiche';
import { mentionFinDeMandat } from '../../lib/meta-parlementaire';

describe('ongletsVisibles', () => {
  it('masque les listes vides, dans l’ordre des onglets', () => {
    // Sébastien Lecornu : onze votes, tous empêchés ; ses prises de parole de ministre.
    expect(ongletsVisibles({ votes: 0, interventions: 167, amendements: 0 })).toEqual(['interventions']);
    expect(ongletsVisibles({ votes: 396, interventions: 0, amendements: 97 })).toEqual(['votes', 'amendements']);
    expect(ongletsVisibles({ votes: 0, interventions: 0, amendements: 0 })).toEqual([]);
  });

  it('garde tous les onglets sans la taille des listes (réponse en cache)', () => {
    expect(ongletsVisibles(undefined)).toEqual(['votes', 'interventions', 'amendements']);
  });
});

describe('mentionFinDeMandat', () => {
  it('nomme le mandat sous un titre au Gouvernement', () => {
    expect(mentionFinDeMandat('ancien sénateur', true, true)).toBe('Ancien sénateur · dernier groupe :');
    expect(mentionFinDeMandat('ancienne députée', true, false)).toBe('Ancienne députée');
  });

  it('garde « Mandat terminé » ailleurs', () => {
    expect(mentionFinDeMandat('ancien député', false, true)).toBe('Mandat terminé · dernier groupe :');
  });
});
