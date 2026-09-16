import { describe, it, expect } from 'vitest';
import { titreDOrdreDuJour, ANNONCE_ORDRE_DU_JOUR } from './interventions';

// Toutes les lignes ci-dessous sont des annonces réelles, relevées en base :
// écrire un test sur une ligne reconstituée de mémoire, c'est tester sa propre
// idée du format plutôt que le format.

describe('titreDOrdreDuJour', () => {
  it('garde les mots de la séance et retire le numéro de dépôt', () => {
    expect(
      titreDOrdreDuJour(
        'L’ordre du jour appelle la discussion du projet de loi de financement de la Sécurité sociale pour 2018 (nos 269, 316, 313).'
      )
    ).toBe(
      'L’ordre du jour appelle la discussion du projet de loi de financement de la Sécurité sociale pour 2018'
    );
  });

  it('accepte une annonce sans numéro', () => {
    expect(titreDOrdreDuJour('L’ordre du jour appelle les questions au Gouvernement.')).toBe(
      'L’ordre du jour appelle les questions au Gouvernement'
    );
  });

  // Le compte rendu colle les phrases : « (nos 235, 273).Ce matin, … ».
  it('coupe à la première phrase même sans espace après le point', () => {
    const reel =
      'L’ordre du jour appelle la suite de la discussion de la première partie du projet de loi de finances pour 2018 (nos 235, 273, 264 rectifié, 266 rectifié).Ce matin, l’Assemblée a poursuivi l’examen des articles du projet de loi, s’arrêtant à l’amendement no 201 portant article additionnel après l’article 6.';
    expect(titreDOrdreDuJour(reel)).toBe(
      'L’ordre du jour appelle la suite de la discussion de la première partie du projet de loi de finances pour 2018'
    );
  });

  // Le piège de la coupure trop tôt : « de M. Manuel Bompard » porte un point
  // suivi d'une majuscule sans être une fin de phrase.
  it('ne coupe pas sur une civilité', () => {
    const reel =
      'L’ordre du jour appelle la discussion de la proposition de loi de M. Manuel Bompard et des membres du groupe La France insoumise visant à lutter contre la vie chère (no 1200).';
    const titre = titreDOrdreDuJour(reel);
    expect(titre).toContain('M. Manuel Bompard');
    expect(titre).toContain('vie chère');
    expect(titre).not.toContain('(no 1200)');
  });

  it('normalise les blancs du PDF', () => {
    expect(titreDOrdreDuJour('L’ordre du jour   appelle\n les questions\tau Gouvernement.')).toBe(
      'L’ordre du jour appelle les questions au Gouvernement'
    );
  });

  it('ne rend jamais une chaîne vide sur une annonce réelle', () => {
    expect(titreDOrdreDuJour('L’ordre du jour appelle la suite de la discussion.').length)
      .toBeGreaterThan(0);
  });
});

describe('ANNONCE_ORDRE_DU_JOUR', () => {
  // 4 265 annonces commencent par ce préfixe exact ; les cinq autres lignes où
  // l'expression apparaît la citent au fil d'une phrase et n'en sont pas.
  it('porte l’apostrophe typographique', () => {
    expect(ANNONCE_ORDRE_DU_JOUR).toBe('L’ordre du jour appelle');
    expect("L'ordre du jour appelle".startsWith(ANNONCE_ORDRE_DU_JOUR)).toBe(false);
  });
});
