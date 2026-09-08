import { describe, it, expect } from 'vitest';

import {
  clefDate,
  construireIndexPersonnes,
  normaliserIdentite,
  rattacher,
  rattacherLot,
} from './rattachement.js';
import type { PersonneReferentiel } from './rattachement.js';

const personne = (
  id: string,
  nom: string,
  prenom: string,
  dateISO: string | null
): PersonneReferentiel => ({
  id,
  nom,
  prenom,
  dateNaissance: dateISO ? new Date(`${dateISO}T00:00:00Z`) : null,
});

const candidat = (nom: string, prenom: string, dateISO: string | null) => ({
  nom,
  prenom,
  dateNaissance: dateISO ? new Date(`${dateISO}T12:00:00Z`) : null,
});

describe('normaliserIdentite', () => {
  it('efface la casse, les accents et la ponctuation des noms composés', () => {
    // La même personne s'écrit « GOY-CHAVENT » dans le fichier du ministère et
    // « Goy Chavent » ailleurs ; l'apostrophe des particules varie aussi.
    expect(normaliserIdentite('GOY-CHAVENT')).toBe(normaliserIdentite('Goy Chavent'));
    expect(normaliserIdentite("D'HAUTEFEUILLE")).toBe(normaliserIdentite('d’Hautefeuille'));
    expect(normaliserIdentite('BÉJEAU')).toBe('BEJEAU');
  });
});

describe('clefDate', () => {
  it('compare au jour près, sans se laisser piéger par l’heure', () => {
    // Le fichier du ministère est lu à midi UTC, l'open data parlementaire à
    // minuit : comparer les horodatages ferait échouer un rapprochement exact.
    expect(clefDate(new Date('1950-03-08T12:00:00Z'))).toBe('1950-03-08');
    expect(clefDate(new Date('1950-03-08T00:00:00Z'))).toBe('1950-03-08');
  });

  it('rend null sur une date absente ou invalide', () => {
    expect(clefDate(null)).toBeNull();
    expect(clefDate(new Date('n’importe quoi'))).toBeNull();
  });
});

describe('rattacher', () => {
  const referentiel = [
    personne('p1', 'MALHURET', 'Claude', '1950-03-08'),
    personne('p2', 'Goy-Chavent', 'Sylvie', '1963-05-23'),
    personne('p3', 'DURAND', 'Jean-Pierre', '1970-01-15'),
  ];
  const index = construireIndexPersonnes(referentiel);

  it('rattache en niveau A sur nom, prénom et date concordants', () => {
    expect(rattacher(candidat('MALHURET', 'Claude', '1950-03-08'), index)).toEqual({
      personneId: 'p1',
      confiance: 'A',
    });
  });

  it('rattache malgré les écarts d’écriture du nom', () => {
    expect(rattacher(candidat('GOY CHAVENT', 'SYLVIE', '1963-05-23'), index)).toEqual({
      personneId: 'p2',
      confiance: 'A',
    });
  });

  it('rattache en niveau B quand seul le prénom diverge', () => {
    // Prénom d'usage : « Jean-Pierre » en base, « Pierre » dans le fichier.
    // Le nom et la date suffisent, mais le rattachement reste marqué.
    expect(rattacher(candidat('DURAND', 'Pierre', '1970-01-15'), index)).toEqual({
      personneId: 'p3',
      confiance: 'B',
    });
  });

  it('ne rattache jamais sur le seul nom', () => {
    // Même nom, même prénom, mais une autre date de naissance : c'est
    // quelqu'un d'autre, et lui coller un historique de votes serait la pire
    // erreur que ce module puisse commettre.
    expect(rattacher(candidat('MALHURET', 'Claude', '1980-03-08'), index)).toBeNull();
  });

  it('ne rattache pas un candidat sans date de naissance', () => {
    expect(rattacher(candidat('MALHURET', 'Claude', null), index)).toBeNull();
  });

  it('refuse de trancher entre deux homonymes nés le même jour', () => {
    // Deux personnes, même nom, même prénom, même date : le corpus ne permet
    // pas de choisir. Se taire vaut mieux que tirer au sort.
    const jumeaux = construireIndexPersonnes([
      personne('j1', 'MARTIN', 'Camille', '1975-06-01'),
      personne('j2', 'MARTIN', 'Camille', '1975-06-01'),
    ]);

    expect(rattacher(candidat('MARTIN', 'Camille', '1975-06-01'), jumeaux)).toBeNull();
  });

  it('ne dégrade pas en niveau B quand plusieurs homonymes existent', () => {
    // Nom et date partagés par deux personnes de prénoms différents : aucune
    // ne peut être choisie sur la seule divergence de prénom.
    const fratrie = construireIndexPersonnes([
      personne('f1', 'MARTIN', 'Camille', '1975-06-01'),
      personne('f2', 'MARTIN', 'Dominique', '1975-06-01'),
    ]);

    expect(rattacher(candidat('MARTIN', 'Alex', '1975-06-01'), fratrie)).toBeNull();
  });
});

describe('construireIndexPersonnes', () => {
  it('écarte les personnes sans date de naissance', () => {
    // Sans date, la seule clef disponible serait le nom : hors de question.
    const index = construireIndexPersonnes([personne('p1', 'MARTIN', 'Camille', null)]);

    expect(index.size).toBe(0);
  });
});

describe('rattacherLot', () => {
  const referentiel = [
    personne('p1', 'MALHURET', 'Claude', '1950-03-08'),
    personne('p3', 'DURAND', 'Jean-Pierre', '1970-01-15'),
    personne('j1', 'MARTIN', 'Camille', '1975-06-01'),
    personne('j2', 'MARTIN', 'Camille', '1975-06-01'),
  ];

  it('compte chaque cas séparément', () => {
    const candidats = [
      candidat('MALHURET', 'Claude', '1950-03-08'), // A
      candidat('DURAND', 'Pierre', '1970-01-15'), // B
      candidat('MARTIN', 'Camille', '1975-06-01'), // ambigu
      candidat('INCONNU', 'Personne', '1990-01-01'), // inconnu
      candidat('SANSDATE', 'Personne', null), // sans date
    ];

    const { rattachements, statistiques } = rattacherLot(candidats, referentiel);

    expect(statistiques).toEqual({
      niveauA: 1,
      niveauB: 1,
      ambigus: 1,
      inconnus: 1,
      sansDate: 1,
    });
    expect(rattachements.size).toBe(2);
  });

  it('n’attribue jamais deux fois la même personne par erreur de clef', () => {
    const candidats = [
      candidat('MALHURET', 'Claude', '1950-03-08'),
      candidat('MALHURET', 'Claude', '1950-03-08'),
    ];

    const { rattachements } = rattacherLot(candidats, referentiel);

    // Deux candidatures distinctes peuvent légitimement pointer la même
    // personne (titulaire ici, suppléant ailleurs) : ce qui compte est que la
    // clef ne se mélange pas.
    expect([...rattachements.values()].map(r => r.personneId)).toEqual(['p1', 'p1']);
  });
});
