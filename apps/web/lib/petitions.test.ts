import { describe, it, expect } from 'vitest';
import { aujourdhuiParis, dateLongue, estAVenir, libelleEtape, morceauxDeTexte, signaturesEnClair, sourceEtape, type EtapePetition } from './petitions';

describe('étapes à venir', () => {
  it('annonce une réunion inscrite à l’agenda, sans la donner pour faite', () => {
    // n° 5174 : examen inscrit le 02/12/2026.
    expect(estAVenir('2026-12-02T00:00:00.000Z', '2026-11-22')).toBe(true);
    expect(libelleEtape('examen', '2026-12-02T00:00:00.000Z', '2026-11-22')).toBe('Examen en commission prévu');
    expect(libelleEtape('examen', '2025-11-05T00:00:00.000Z', '2026-11-22')).toBe('Examen en commission');
  });

  it('le jour même, l’étape n’est plus à venir', () => {
    expect(estAVenir('2026-11-22T00:00:00.000Z', '2026-11-22')).toBe(false);
  });

  it('une étape sans date n’est jamais à venir', () => {
    expect(libelleEtape('seuil_atteint', null, '2026-11-22')).toBe('Seuil de 100 000 signatures atteint');
  });

  it('prend la date de Paris, pas celle d’UTC', () => {
    expect(aujourdhuiParis(new Date('2026-11-21T23:30:00Z'))).toBe('2026-11-22');
  });
});

describe('formats', () => {
  it('lit une date civile sans décalage de fuseau', () => {
    expect(dateLongue('2026-04-15T00:00:00.000Z')).toBe('15 avril 2026');
  });

  it('compte les signatures, et dit quand la source ne les donne pas', () => {
    expect(signaturesEnClair(2131368)).toBe('2 131 368 signatures');
    expect(signaturesEnClair(1)).toBe('1 signature');
    expect(signaturesEnClair(null)).toBe('compteur non publié');
  });
});

describe('sourceEtape', () => {
  const base: EtapePetition = { type: 'examen', date: null, source: 'plateforme', rattachement: 'plateforme', libelle: '', reunion: null, dossier: null };

  it('mène à la réunion, au dossier ou à la page officielle', () => {
    expect(sourceEtape({ ...base, source: 'agenda_an', reunion: { uid: 'RUANR5L17S2026IDC457795', dateDebut: '', etat: 'confirme', commission: null } }, 'u').href)
      .toBe('/reunions/RUANR5L17S2026IDC457795');
    expect(sourceEtape({ ...base, source: 'dossier_an', dossier: { uid: 'DLR5L17N53136', titre: '' } }, 'u').href).toBe('/dossiers/DLR5L17N53136');
    expect(sourceEtape(base, 'https://petitions.senat.fr/initiatives/i-742')).toMatchObject({ externe: true, href: 'https://petitions.senat.fr/initiatives/i-742' });
  });
});

describe('morceauxDeTexte', () => {
  it('rend les liens Markdown et les adresses nues', () => {
    expect(morceauxDeTexte('Voir [le rapport](https://www.senat.fr/r.html) ou https://videos.assemblee-nationale.fr/v.1.')).toEqual([
      { texte: 'Voir ' },
      { texte: 'le rapport', href: 'https://www.senat.fr/r.html' },
      { texte: ' ou ' },
      { texte: 'https://videos.assemblee-nationale.fr/v.1', href: 'https://videos.assemblee-nationale.fr/v.1' },
      { texte: '.' },
    ]);
  });

  it('laisse un lien non http en texte', () => {
    expect(morceauxDeTexte('[clic](javascript:alert(1))')).toEqual([{ texte: '[clic](javascript:alert(1))' }]);
  });
});

describe('morceauxDeTexte et renvois', () => {
  it('mène les personnes résolues à leur fiche CLAIR', () => {
    const renvois = [
      { type: 'lien' as const, cle: 'http://www.senat.fr/senateur/carrere_maryse19629c.html', chemin: '/senateurs/maryse-carrere' },
      { type: 'nom' as const, cle: 'Hélène Laporte', chemin: '/deputes/helene-laporte' },
    ];
    expect(
      morceauxDeTexte('de Mme [Maryse CARRÈRE](http://www.senat.fr/senateur/carrere_maryse19629c.html) et Mme Hélène Laporte, rapporteure', renvois),
    ).toEqual([
      { texte: 'de Mme ' },
      { texte: 'Maryse CARRÈRE', href: '/senateurs/maryse-carrere', interne: true },
      { texte: ' et Mme ' },
      { texte: 'Hélène Laporte', href: '/deputes/helene-laporte', interne: true },
      { texte: ', rapporteure' },
    ]);
  });
});
