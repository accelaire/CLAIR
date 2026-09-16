
// =============================================================================
// Fiches de commission
// =============================================================================
//
// Le fragment ci-dessous est copié d'une page réelle de videos.senat.fr : c'est
// la vidéo de l'audition qui a révélé le manque.

import { fichesDeCommission, dateDeLaFiche } from './videos-client';

const FICHE_REELLE = `
<div class="swiper-slide ">
  <div class="card card-default ">
    <div class="card-header"><div class="card-duration">2 h 13</div></div>
    <div class="card-body">
      <h3 class="card-title">
        <a href="video.5946696_6aaa33db7289a.violences-dans-le-periscolaire--audition-d-emmanuel-gregoire" class="stretched-link" title="x">
          Violences dans le périscolaire : audition d&#39;Emmanuel Grégoire        </a>
      </h3>
      <p class="card-subtitle">Commission de la culture, de l'éducation, de la communication et du sport</p>
      <time class="card-time">Mercredi 16 septembre 2026</time>
    </div>
  </div>
</div>`;

describe('dateDeLaFiche', () => {
  it('lit une date en toutes lettres', () => {
    expect(dateDeLaFiche('Mercredi 16 septembre 2026')).toBe('2026-09-16');
    expect(dateDeLaFiche('Jeudi 5 février 2026')).toBe('2026-02-05');
    expect(dateDeLaFiche('Lundi 1 août 2025')).toBe('2025-08-01');
  });

  it('rend null sur ce qu’elle ne sait pas lire', () => {
    expect(dateDeLaFiche('')).toBeNull();
    expect(dateDeLaFiche('Mercredi 16 brumaire 2026')).toBeNull();
  });
});

describe('fichesDeCommission', () => {
  it('lit la commission, la date et le lien', () => {
    const [f] = fichesDeCommission(FICHE_REELLE);
    expect(f).toBeDefined();
    expect(f!.isoDate).toBe('2026-09-16');
    expect(f!.commission).toBe(
      "Commission de la culture, de l'éducation, de la communication et du sport"
    );
    expect(f!.titre).toContain('Emmanuel Grégoire');
    expect(f!.url).toBe(
      'https://videos.senat.fr/video.5946696_6aaa33db7289a.violences-dans-le-periscolaire--audition-d-emmanuel-gregoire'
    );
  });

  it('écarte les vidéos de séance publique', () => {
    const seance = FICHE_REELLE.replace(
      'violences-dans-le-periscolaire--audition-d-emmanuel-gregoire',
      'seance-publique-du-16-septembre-2026-matin'
    );
    expect(fichesDeCommission(seance)).toHaveLength(0);
  });

  // Sans commission ou sans date, on ne saurait pas à quelle réunion rattacher :
  // rapprocher sur la seule date donnerait la vidéo d'une commission à une autre.
  it('écarte une fiche sans commission', () => {
    expect(fichesDeCommission(FICHE_REELLE.replace(/<p class="card-subtitle">.*?<\/p>/s, ''))).toHaveLength(0);
  });

  it('écarte une fiche sans date', () => {
    expect(fichesDeCommission(FICHE_REELLE.replace(/<time class="card-time">.*?<\/time>/s, ''))).toHaveLength(0);
  });

  it('ne rend qu’une fois une vidéo présente deux fois', () => {
    expect(fichesDeCommission(FICHE_REELLE + FICHE_REELLE)).toHaveLength(1);
  });
});
