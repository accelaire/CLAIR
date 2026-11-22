import { describe, it, expect } from 'vitest';
import {
  collecte,
  decoderEntites,
  extraire,
  formeComparable,
  legislatureAN,
  LigneInvalide,
  lireSignatures,
  masquerCoordonnees,
  nettoyerTexte,
  normaliserLigne,
  recollerParagraphes,
  texteLisible,
  verifierColonnes,
  COLONNES_PETITIONS,
} from './normalisation';

const jour = (iso: string) => new Date(`${iso}T00:00:00Z`);

// Lignes réelles des fichiers du 18/11/2026, description raccourcie.
const LIGNE_AN = {
  titre: 'Non à la Loi Duplomb — Pour la santé, la sécurité, l’intelligence collective.',
  description: 'Monsieur le Président de l’Assemblée nationale, La loi Duplomb &amp; ses suites…',
  date_publication: '2025-07-10',
  nb_votes: '2131368.0',
  statut: 'ouverte',
  date_limite_vote: '2025-12-02',
  commission: 'Commission des affaires économiques',
  legislature: '',
  decision_commission: '',
  url: 'https://petitions.assemblee-nationale.fr/initiatives/i-3014',
  identifiant: '3014',
};

const LIGNE_SENAT = {
  titre: 'Morts, violences et abus liés à la chasse : plus jamais ça !',
  description: 'Le 2 décembre dernier, en plein confinement…',
  date_publication: '2021-09-10',
  nb_votes: '122484',
  statut: 'Seuil atteint',
  date_limite_vote: '2021-11-23',
  type: 'Texte législatif',
  url: 'https://petitions.senat.fr/initiatives/i-742',
  identifiant: '742',
};

describe('verifierColonnes', () => {
  it("accepte l'en-tête exact, BOM compris", () => {
    expect(() => verifierColonnes('assemblee', ['﻿titre', ...COLONNES_PETITIONS.assemblee.slice(1)])).not.toThrow();
    expect(() => verifierColonnes('senat', COLONNES_PETITIONS.senat)).not.toThrow();
  });

  it('refuse une colonne en plus, en moins ou déplacée', () => {
    expect(() => verifierColonnes('senat', [...COLONNES_PETITIONS.senat, 'commission'])).toThrow(/colonnes inattendues/);
    expect(() => verifierColonnes('senat', COLONNES_PETITIONS.senat.slice(1))).toThrow();
    expect(() => verifierColonnes('assemblee', COLONNES_PETITIONS.senat)).toThrow();
  });
});

describe('nettoyage du texte', () => {
  it('décode les entités des fichiers, &amp; en dernier', () => {
    expect(decoderEntites('a &gt; b &amp; c &lt; d')).toBe('a > b & c < d');
    expect(decoderEntites('&amp;gt;')).toBe('&gt;');
  });

  it('retire BOM et espaces de largeur nulle, ramène les blancs', () => {
    expect(nettoyerTexte('﻿Conformément à  la​ décision ')).toBe('Conformément à la décision');
  });

  it('masque courriels et numéros de téléphone, pas les montants ni les dates', () => {
    expect(masquerCoordonnees('écrire à jean.dupont+asso@exemple.fr')).toBe('écrire à [courriel masqué]');
    expect(masquerCoordonnees('appeler le 06 12 34 56 78 ou le +33 6.12.34.56.78')).toBe(
      'appeler le [téléphone masqué] ou le [téléphone masqué]',
    );
    expect(masquerCoordonnees('un budget de 1 200 000 000 euros en 2026-2027')).toBe(
      'un budget de 1 200 000 000 euros en 2026-2027',
    );
  });
});

describe('recollerParagraphes', () => {
  it('rend l’espace perdue entre deux paragraphes', () => {
    // n° 3014 et n° 5820, fichier du 18/11/2026.
    expect(recollerParagraphes('Responsabilité Sociétale des Entreprises).En tant que future')).toBe(
      'Responsabilité Sociétale des Entreprises). En tant que future',
    );
    expect(recollerParagraphes('sur une fréquence publique :Des propos')).toBe('sur une fréquence publique : Des propos');
    expect(recollerParagraphes('de 2026.Il est urgent')).toBe('de 2026. Il est urgent');
  });

  it('laisse les initiales et les sigles', () => {
    expect(recollerParagraphes('M.Dupont et la S.A.R.L. Martin')).toBe('M.Dupont et la S.A.R.L. Martin');
    expect(recollerParagraphes('le site www.service-public.fr')).toBe('le site www.service-public.fr');
  });
});

describe('texteLisible', () => {
  // Jointures réelles du fichier du 18/11/2026 (n° 3014, 3820, 6706, Sénat 1201).
  it('ouvre un paragraphe à chaque fin de phrase collée', () => {
    expect(texteLisible('des Entreprises).En tant que future professionnelle.La Loi Duplomb')).toBe(
      'des Entreprises).\n\nEn tant que future professionnelle.\n\nLa Loi Duplomb',
    );
  });

  it('ouvre un paragraphe sur un début de phrase collé à une minuscule', () => {
    expect(texteLisible('résiliente et inclusiveNous demandons')).toBe('résiliente et inclusive\n\nNous demandons');
  });

  it('laisse les mots composés en casse mixte', () => {
    expect(texteLisible('sur YouTube et LinkedIn, un iPhone.')).toBe('sur YouTube et LinkedIn, un iPhone.');
  });

  it('met une liste à tirets à la ligne, un élément par ligne', () => {
    expect(texteLisible('Conséquences :- La médaille ne lui fut jamais attribuée- Sa performance fut créditée')).toBe(
      'Conséquences :\n– La médaille ne lui fut jamais attribuée\n– Sa performance fut créditée',
    );
  });

  it('laisse un tiret espacé dans la ligne', () => {
    expect(texteLisible('l’article 2. Article 7 – Sanctions en cas de manquement')).toBe(
      'l’article 2. Article 7 – Sanctions en cas de manquement',
    );
  });

  it('met les listes numérotées et à puces à la ligne', () => {
    expect(texteLisible('sont multiples :1.Des durées de congés trop courtes.2.Des indemnités')).toBe(
      'sont multiples :\n1. Des durées de congés trop courtes.\n2. Des indemnités',
    );
    expect(texteLisible('mieux recyclées ?• Au contraire')).toBe('mieux recyclées ?\n• Au contraire');
  });

  it('ouvre un paragraphe sur un titre en chiffres romains', () => {
    // Sénat n° 742, AN n° 447 et 3742.
    expect(texteLisible('ni notre bien-être. I - Dimanche et mercredi sans chasse')).toBe(
      'ni notre bien-être.\n\nI – Dimanche et mercredi sans chasse',
    );
    expect(texteLisible('les incidents en gendarmerie.III- Contrôle et suivi')).toBe(
      'les incidents en gendarmerie.\n\nIII – Contrôle et suivi',
    );
    expect(texteLisible('de réduction de l’endettementII. MÉCONTENTEMENT POPULAIRE')).toBe(
      'de réduction de l’endettement\n\nII. MÉCONTENTEMENT POPULAIRE',
    );
  });

  it('laisse les sigles et les noms de souverains', () => {
    expect(texteLisible('plus de 130% du P.I.B de l’année')).toBe('plus de 130% du P.I.B de l’année');
    expect(texteLisible('sous Louis XIV. Le roi')).toBe('sous Louis XIV. Le roi');
  });

  it('coupe sur un séparateur en tirets', () => {
    expect(texteLisible('Conseil constitutionnel---EXPOSÉ DES MOTIFS')).toBe('Conseil constitutionnel\n\nEXPOSÉ DES MOTIFS');
  });

  it('passe à la ligne après une formule d’appel', () => {
    expect(texteLisible('Messieurs les Députés,Nous, citoyens français')).toBe('Messieurs les Députés,\nNous, citoyens français');
  });

  it('ne coupe pas après une abréviation, et masque les coordonnées', () => {
    expect(texteLisible('la fin de vie (cf.Irvin Yalom).')).toBe('la fin de vie (cf. Irvin Yalom).');
    expect(texteLisible('Écrivez à jean.dupont@example.org.Merci')).toBe('Écrivez à [courriel masqué].\n\nMerci');
  });
});

describe('extraire', () => {
  it('rend un texte court tel quel', () => {
    expect(extraire('Pour une juste fiscalité.')).toBe('Pour une juste fiscalité.');
  });

  it('coupe à la fin de la dernière phrase qui tient', () => {
    const texte = `${'a'.repeat(250)}. ${'b'.repeat(200)}.`;
    expect(extraire(texte)).toBe(`${'a'.repeat(250)}.`);
  });

  it('coupe sur un mot et le signale quand aucune phrase ne tient', () => {
    const texte = Array.from({ length: 100 }, () => 'mot').join(' ');
    const e = extraire(texte);
    expect(e.endsWith('mot…')).toBe(true);
    expect(e.length).toBeLessThanOrEqual(301);
  });
});

describe('lireSignatures', () => {
  it('lit le flottant entier de l’AN et l’entier du Sénat', () => {
    expect(lireSignatures('425.0')).toBe(425);
    expect(lireSignatures('122484')).toBe(122484);
  });

  it('rend null pour un compteur absent, lève pour un compteur illisible', () => {
    expect(lireSignatures('')).toBeNull();
    expect(() => lireSignatures('12,5')).toThrow(LigneInvalide);
    expect(() => lireSignatures('425.5')).toThrow(LigneInvalide);
  });
});

describe('legislatureAN', () => {
  it('lit le libellé des pétitions archivées', () => {
    expect(legislatureAN('2017-2022', 'archivee', 17)).toBe(15);
    expect(legislatureAN('2022-2024', 'archivee', 17)).toBe(16);
  });

  it('donne la législature courante aux autres', () => {
    expect(legislatureAN('', 'ouverte', 17)).toBe(17);
    expect(legislatureAN('', 'classee', 17)).toBe(17);
  });

  it("ne devine pas : libellé inconnu ou archivée sans libellé → null", () => {
    expect(legislatureAN('2031-2036', 'archivee', 17)).toBeNull();
    expect(legislatureAN('', 'archivee', 17)).toBeNull();
  });
});

describe('collecte', () => {
  it('croise statut et date limite', () => {
    expect(collecte('ouverte', jour('2029-06-19'), jour('2026-11-22'))).toBe('ouverte');
    expect(collecte('Ouverte', null, jour('2026-11-22'))).toBe('ouverte');
    // n° 3014 : « ouverte » à la source, date limite passée depuis le 02/12/2025.
    expect(collecte('ouverte', jour('2025-12-02'), jour('2026-11-22'))).toBe('close');
    expect(collecte('classee', jour('2029-06-19'), jour('2026-11-22'))).toBe('close');
    expect(collecte('Seuil atteint', null, jour('2026-11-22'))).toBe('close');
  });

  it('la collecte reste ouverte le jour de la date limite', () => {
    expect(collecte('ouverte', jour('2026-11-22'), new Date('2026-11-22T21:00:00Z'))).toBe('ouverte');
  });
});

describe('formeComparable', () => {
  it('rend égaux les titres de l’agenda et de la plateforme', () => {
    // Agenda de la commission des affaires économiques, 05/11/2025, et CSV.
    expect(formeComparable('Non à la Loi Duplomb - Pour la santé, la sécurité, l’intelligence collective')).toBe(
      formeComparable('Non à la Loi Duplomb — Pour la santé, la sécurité, l’intelligence collective.'),
    );
    expect(formeComparable("Supprimer CNews de l’audiovisuel français")).toBe(
      formeComparable("Supprimer CNews de l'audiovisuel français"),
    );
  });

  it('garde les accents et les mots : pas de rapprochement approximatif', () => {
    expect(formeComparable('Pétition contre la loi Duplomb')).not.toBe(formeComparable('petition contre la loi Duplomb'));
    expect(formeComparable('Non à la loi Duplomb')).not.toBe(formeComparable('Non c’est Non, Monsieur Duplomb !'));
  });
});

describe('normaliserLigne', () => {
  it('normalise une ligne AN', () => {
    const p = normaliserLigne('assemblee', LIGNE_AN, 17);
    expect(p).toMatchObject({
      chambre: 'assemblee',
      numero: 3014,
      signatures: 2131368,
      statutSource: 'ouverte',
      legislature: 17,
      commissionSource: 'Commission des affaires économiques',
      decisionSource: null,
      typeSource: null,
    });
    expect(p.description).toContain('Duplomb & ses');
    expect(p.datePublication.toISOString()).toBe('2025-07-10T00:00:00.000Z');
    expect(p.dateLimite?.toISOString()).toBe('2025-12-02T00:00:00.000Z');
  });

  it('normalise une ligne Sénat', () => {
    const p = normaliserLigne('senat', LIGNE_SENAT, 17);
    expect(p).toMatchObject({ numero: 742, signatures: 122484, legislature: null, typeSource: 'Texte législatif', commissionSource: null });
  });

  it("refuse une ligne dont l'URL ne correspond pas à son numéro", () => {
    expect(() => normaliserLigne('senat', { ...LIGNE_SENAT, url: 'https://petitions.senat.fr/initiatives/i-743' }, 17)).toThrow(LigneInvalide);
    expect(() => normaliserLigne('senat', { ...LIGNE_SENAT, identifiant: 'i-742' }, 17)).toThrow(LigneInvalide);
  });

  it('refuse une date impossible', () => {
    expect(() => normaliserLigne('senat', { ...LIGNE_SENAT, date_publication: '2021-02-30' }, 17)).toThrow(LigneInvalide);
  });
});
