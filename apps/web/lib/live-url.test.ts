import { describe, expect, it } from 'vitest';
import { directsDesReunions, jourAParis, videoIdDe, type LiveNowResponse, type ReunionRapprochable } from './live-url';

const SENAT_SEANCE = { slug: 'senat-seance', nom: 'Sénat', organeRef: 'PO78718', chambre: 'senat' };
const PROSPECTIVE = { slug: 'senat-delegation-prospective', nom: 'Délégation sénatoriale à la prospective', organeRef: 'PO420388', chambre: 'senat' };
const AFFAIRES_SOCIALES = { slug: 'senat-affaires-sociales', nom: 'Commission des affaires sociales', organeRef: 'COM-SOCI', chambre: 'senat' };
const COLLECTIVITES = {
  slug: 'senat-collectivites',
  nom: 'Délégation sénatoriale aux collectivités territoriales et à la décentralisation',
  organeRef: 'PO-COLL',
  chambre: 'senat',
};

const reunion = (
  id: string, type: string, dateDebut: string, commission: ReunionRapprochable['commission'], urlVideo: string | null = null,
): ReunionRapprochable => ({ id, type, dateDebut, dateFin: null, urlVideo, commission });

// Le 10/11/2026 tel que l'agenda de prod le porte (heures UTC), et la page des
// directs du Sénat relevée à 13 h 35 UTC.
const DIX_NOVEMBRE: ReunionRapprochable[] = [
  reunion('seance-0930', 'seance', '2026-11-10T08:30:00Z', SENAT_SEANCE, 'https://videos.senat.fr/video.5994202_6af2cb11cc694.seance-publique-du-10-novembre-2026-matin'),
  reunion('prospective', 'commission', '2026-11-10T12:30:00Z', PROSPECTIVE, 'https://videos.senat.fr/video.5994629_6af2f10ab1218.france-2035-france-2050--comment-vivrons-nous-demain--'),
  reunion('soci', 'commission', '2026-11-10T12:30:00Z', AFFAIRES_SOCIALES),
  reunion('seance-1400', 'seance', '2026-11-10T13:00:00Z', SENAT_SEANCE, 'https://videos.senat.fr/video.5995048_6af3142162bba.seance-publique-du-10-novembre-2026-apres-midi'),
  reunion('seance-1430', 'seance', '2026-11-10T13:30:00Z', SENAT_SEANCE, 'https://videos.senat.fr/video.5995048_6af3142162bba.seance-publique-du-10-novembre-2026-apres-midi'),
];

const LIVE_DIX_NOVEMBRE: LiveNowResponse = {
  seances: [{
    chambre: 'senat', isoDate: '2026-11-10', order: 2, enCours: true,
    directUrl: 'https://videos.senat.fr/video.5995048_6af3142162bba.seance-publique-du-10-novembre-2026-apres-midi',
    videoId: '5995048_6af3142162bba',
  }],
  commissions: [{
    chambre: 'senat', organeRef: null, enCours: true, libelle: 'Délégation sénatoriale à la prospective',
    directUrl: 'https://videos.senat.fr/video.5994629_6af2f10ab1218.france-2035-france-2050--comment-vivrons-nous-demain--',
    videoId: '5994629_6af2f10ab1218',
  }],
};

describe('directsDesReunions — Sénat', () => {
  it('10/11 à 14 h 35 : la séance en cours et la délégation, rien d’autre', () => {
    const directs = directsDesReunions(DIX_NOVEMBRE, LIVE_DIX_NOVEMBRE, Date.parse('2026-11-10T13:35:44Z'));
    expect([...directs.keys()].sort()).toEqual(['prospective', 'seance-1430']);
  });

  it('une commission du Sénat sans vidéo rattachée se reconnaît à son nom', () => {
    const sansVideo = DIX_NOVEMBRE.map((r) => (r.id === 'prospective' ? { ...r, urlVideo: null } : r));
    const directs = directsDesReunions(sansVideo, LIVE_DIX_NOVEMBRE, Date.parse('2026-11-10T13:35:44Z'));
    expect(directs.get('prospective')).toBe(LIVE_DIX_NOVEMBRE.commissions[0]!.directUrl);
  });

  it('par le nom seul, pas au-delà de la fenêtre de la réunion', () => {
    const sansVideo = DIX_NOVEMBRE.map((r) => (r.id === 'prospective' ? { ...r, urlVideo: null } : r));
    const directs = directsDesReunions(sansVideo, LIVE_DIX_NOVEMBRE, Date.parse('2026-11-10T17:00:00Z'));
    expect(directs.has('prospective')).toBe(false);
  });

  it('une séance confirmée garde son badge au-delà de 4 h : le Sénat n’annonce pas de fin', () => {
    const directs = directsDesReunions(DIX_NOVEMBRE, LIVE_DIX_NOVEMBRE, Date.parse('2026-11-10T19:45:00Z'));
    expect(directs.has('seance-1430')).toBe(true);
    expect(directs.has('seance-1400')).toBe(false);
  });

  it('le soir, le direct du soir revient à la séance de l’après-midi qui se poursuit', () => {
    const live: LiveNowResponse = {
      commissions: [],
      seances: [{ chambre: 'senat', isoDate: '2026-11-17', order: 3, enCours: true, directUrl: 'https://videos.senat.fr/video.1_ab.seance-publique-du-17-novembre-2026-soir' }],
    };
    const directs = directsDesReunions(
      [reunion('seance', 'seance', '2026-11-17T13:30:00Z', SENAT_SEANCE)],
      live,
      Date.parse('2026-11-17T21:00:00Z'),
    );
    expect(directs.get('seance')).toBe(live.seances[0]!.directUrl);
  });

  it('pas de badge plus de 15 min avant l’heure', () => {
    const directs = directsDesReunions(DIX_NOVEMBRE, LIVE_DIX_NOVEMBRE, Date.parse('2026-11-10T12:00:00Z'));
    expect(directs.has('prospective')).toBe(false);
  });

  it('réunion conjointe « A • B », nom court passé par l’alias', () => {
    const live: LiveNowResponse = {
      seances: [],
      commissions: [{
        chambre: 'senat', organeRef: null, enCours: true,
        libelle: 'Commission des affaires étrangères, de la défense et des forces armées • Délégation aux collectivités territoriales',
        directUrl: 'https://videos.senat.fr/video.5726830_69c2ae58c58ac.quelles-resiliences',
      }],
    };
    const directs = directsDesReunions(
      [reunion('coll', 'commission', '2026-03-24T14:00:00Z', COLLECTIVITES)],
      live,
      Date.parse('2026-03-24T15:53:00Z'),
    );
    expect(directs.has('coll')).toBe(true);
  });

  it('un direct du Sénat ne va jamais à une réunion de l’AN', () => {
    const an = reunion('an', 'seance', '2026-11-10T13:00:00Z', { slug: 'an-seance', nom: 'Assemblée', organeRef: 'PO838901', chambre: 'assemblee' });
    const directs = directsDesReunions([an], LIVE_DIX_NOVEMBRE, Date.parse('2026-11-10T13:35:44Z'));
    expect(directs.size).toBe(0);
  });
});

describe('directsDesReunions — Assemblée (catalogue, non confirmé)', () => {
  const LOIS = { slug: 'an-lois', nom: 'Commission des lois', organeRef: 'PO59051', chambre: 'assemblee' };
  const live: LiveNowResponse = {
    seances: [],
    commissions: [
      { chambre: 'assemblee', organeRef: 'PO59051', enCours: false, videoId: '19709612_6afb17f5a008e', directUrl: 'https://videos.assemblee-nationale.fr/direct.19709612_6afb17f5a008e' },
      { chambre: 'assemblee', organeRef: null, enCours: false, videoId: '19710080_6afb29ed01611', directUrl: 'https://videos.assemblee-nationale.fr/direct.19710080_6afb29ed01611' },
    ],
  };

  it('la fenêtre de la réunion décide', () => {
    const r = { ...reunion('lois', 'commission', '2026-11-16T15:00:00Z', LOIS), dateFin: '2026-11-16T16:55:00Z' };
    expect(directsDesReunions([r], live, Date.parse('2026-11-16T16:00:00Z')).has('lois')).toBe(true);
    expect(directsDesReunions([r], live, Date.parse('2026-11-16T17:30:00Z')).has('lois')).toBe(false);
  });

  it('une commission d’enquête au code vidéo inconnu passe par sa vidéo rattachée', () => {
    const ce = reunion('ce', 'commission', '2026-11-16T16:00:00Z', { slug: 'an-ce', nom: 'CE aides sociales', organeRef: 'PO999999', chambre: 'assemblee' }, 'https://videos.assemblee-nationale.fr/video.19710080_6afb29ed01611');
    expect(directsDesReunions([ce], live, Date.parse('2026-11-16T16:30:00Z')).get('ce')).toBe(live.commissions[1]!.directUrl);
  });
});

describe('outils', () => {
  it('videoIdDe lit les deux formes d’URL', () => {
    expect(videoIdDe('https://videos.senat.fr/video.5994629_6af2f10ab1218.france-2035')).toBe('5994629_6af2f10ab1218');
    expect(videoIdDe('https://videos.assemblee-nationale.fr/video.19709612_6afb17f5a008e')).toBe('19709612_6afb17f5a008e');
    expect(videoIdDe('https://videos.assemblee-nationale.fr/direct.19709612_6afb17f5a008e')).toBe('19709612_6afb17f5a008e');
    expect(videoIdDe(null)).toBeNull();
  });

  it('jourAParis : 23 h 30 UTC en hiver, c’est déjà le lendemain', () => {
    expect(jourAParis('2026-11-16T23:30:00Z')).toBe('2026-11-17');
  });
});
