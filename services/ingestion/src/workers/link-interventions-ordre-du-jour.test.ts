import { describe, it, expect } from 'vitest';
import { dossierDuPoint, numerosDeLAnnonce, premierePhrase } from './link-interventions-ordre-du-jour';

// Annonce relevée dans le compte rendu du 8 octobre 2026 au matin.
const SCHENGEN =
  'L’ordre du jour appelle la discussion, en application de l’article 34-1 de la Constitution, de la proposition de résolution de Mme Manon Bouquin et plusieurs de ses collègues visant à refonder l’espace Schengen en instaurant une double frontière nationale et européenne (nos 3119).';
const QAG = 'L’ordre du jour appelle les questions au Gouvernement.';

describe('numerosDeLAnnonce', () => {
  it('lit le numéro de dépôt, au singulier comme au pluriel', () => {
    expect(numerosDeLAnnonce(SCHENGEN)).toEqual(['3119']);
    expect(numerosDeLAnnonce('L’ordre du jour appelle la discussion du projet de loi (nos 235, 273). La parole est à M. le ministre (no 12).')).toEqual(['235', '273']);
    expect(numerosDeLAnnonce('L’ordre du jour appelle la suite de la discussion de la proposition de loi (no 3190 rectifié).')).toEqual(['3190']);
  });

  it("ne lit que la première phrase : les suivantes n'annoncent plus le point", () => {
    expect(numerosDeLAnnonce(`${QAG} Je rappelle le texte no 42.`)).toEqual([]);
    expect(numerosDeLAnnonce(`${QAG}La conférence des présidents a examiné le texte (no 42).`)).toEqual([]);
  });

  it('ne retient pas un numéro de loi cité dans le titre', () => {
    expect(
      numerosDeLAnnonce('L’ordre du jour appelle la discussion du projet de loi ratifiant l’ordonnance no 2017-31 du 12 janvier 2017 (no 44).'),
    ).toEqual(['44']);
  });
});

describe('premierePhrase', () => {
  it("ne coupe pas sur l'abréviation d'un nom", () => {
    expect(premierePhrase('L’ordre du jour appelle la proposition de loi de M. Dupont visant à X (no 1).La parole est à M. Y.')).toBe(
      'L’ordre du jour appelle la proposition de loi de M. Dupont visant à X (no 1)',
    );
  });
});

describe('dossierDuPoint', () => {
  it('rattache au dossier que désignent tous les numéros, texte et rapport compris', () => {
    expect(dossierDuPoint(['fin-de-vie', 'fin-de-vie'])).toBe('fin-de-vie');
  });

  it('renonce devant une discussion commune de deux textes', () => {
    // « Justice criminelle » : projet de loi (nos 2681, 2904) et projet de loi organique (nos 2682, 2905).
    expect(dossierDuPoint(['justice-criminelle', 'justice-criminelle', 'loi-organique'])).toBeNull();
  });

  it('ne rattache rien sans numéro résolu : questions, nominations, débats', () => {
    expect(dossierDuPoint([])).toBeNull();
  });
});
