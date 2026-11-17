import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { directsCommissionsAn, directsSeancesAn, directsSenat, type RawAnVideo } from './live-now-sources';

const fixture = (nom: string) => readFileSync(join(__dirname, '__fixtures__', nom), 'utf8');

describe('directsSenat — page videos.senat.fr/direct', () => {
  it('10/11/2026 : la séance ET la délégation en direct, toutes deux confirmées', () => {
    const { seances, commissions } = directsSenat(fixture('senat-direct-2026-11-10.html'));
    expect(seances).toEqual([{
      chambre: 'senat',
      isoDate: '2026-11-10',
      order: 2,
      directUrl: 'https://videos.senat.fr/video.5995048_6af3142162bba.seance-publique-du-10-novembre-2026-apres-midi',
      videoId: '5995048_6af3142162bba',
      enCours: true,
    }]);
    expect(commissions).toEqual([{
      chambre: 'senat',
      directUrl: 'https://videos.senat.fr/video.5994629_6af2f10ab1218.france-2035-france-2050--comment-vivrons-nous-demain--',
      videoId: '5994629_6af2f10ab1218',
      organeRef: null,
      libelle: 'Délégation sénatoriale à la prospective',
      enCours: true,
    }]);
  });

  it('24/03/2026 : cinq directs d’organes, réunions conjointes comprises', () => {
    const { seances, commissions } = directsSenat(fixture('senat-direct-2026-03-24.html'));
    expect(seances).toEqual([]);
    expect(commissions.map((c) => c.libelle)).toEqual([
      "Commission de l'aménagement du territoire et du développement durable • Commission des affaires économiques",
      'Commission des affaires étrangères, de la défense et des forces armées • Délégation aux collectivités territoriales',
      "Commission de la culture, de l'éducation, de la communication et du sport",
      'MI Souffrance psychique au travail',
      'MI Loi littoral Loi montagne',
    ]);
  });

  it('« Aucune retransmission en cours » : rien', () => {
    expect(directsSenat(fixture('senat-direct-aucun.html'))).toEqual({ commissions: [], seances: [] });
  });
});

describe('catalogue de l’AN', () => {
  const now = Date.parse('2026-11-16T21:00:00Z');
  const video = (date: string, url: string, title: string, commission: string | null = null): RawAnVideo => ({
    date: String(Date.parse(date) / 1000), url, title, commission, video_type: 'C', published: true,
  });

  it('garde un organe par code d’une réunion conjointe, et la vidéo d’un code inconnu', () => {
    const directs = directsCommissionsAn([
      video('2026-11-16T16:20:00Z', '/19701767_6af34458efcbc', 'Commissions conjointes', 'CION_AFETR;DUE'),
      video('2026-11-16T16:06:04Z', '/19710080_6afb29ed01611', 'Coût réel des aides sociales', 'CEAISOC'),
    ], now);
    expect(directs.map((d) => [d.organeRef, d.videoId, d.enCours])).toEqual([
      ['PO59047', '19701767_6af34458efcbc', false],
      ['PO59054', '19701767_6af34458efcbc', false],
      [null, '19710080_6afb29ed01611', false],
    ]);
  });

  it('écarte les vidéos de plus de 18 h, garde la séance d’hier soir après minuit', () => {
    const apresMinuit = Date.parse('2026-11-17T00:30:00Z'); // 1 h 30 à Paris
    const seances = directsSeancesAn([
      video('2026-11-16T20:15:07Z', '/19711126_6afb644b55198', '2ème séance : Relance et décentralisation du logement (suite)'),
      video('2026-11-12T13:45:38Z', '/19704988_6af5c3024f1bd', '2ème séance : Projet de loi de finances de fin de gestion'),
    ], apresMinuit);
    expect(seances).toEqual([{
      chambre: 'assemblee',
      isoDate: '2026-11-16',
      order: 2,
      directUrl: 'https://videos.assemblee-nationale.fr/direct.19711126_6afb644b55198',
      videoId: '19711126_6afb644b55198',
      enCours: false,
    }]);
  });
});
