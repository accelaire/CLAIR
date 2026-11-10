import { describe, expect, it } from 'vitest';
import { sansDonneesSource } from './api-server';

describe('sansDonneesSource', () => {
  it('retire sourceData à toutes les profondeurs et garde le reste', () => {
    const reponse = {
      data: {
        slug: 'gabrielle-cathala',
        sourceData: { adresses: [{ valElec: '/in/gabrielle-cathala' }] },
        mandats: [{ id: 1, sourceData: { url: '/senateur/naturel_georges21029d.html' } }],
      },
    };
    const lu = sansDonneesSource(JSON.stringify(reponse));
    expect(lu).toEqual({ data: { slug: 'gabrielle-cathala', mandats: [{ id: 1 }] } });
    expect(JSON.stringify(lu)).not.toContain('/in/');
  });

  it('laisse intacte une réponse sans sourceData', () => {
    const reponse = { data: [{ numero: 8447, votes: [null, 0, 'pour'] }], total: 1 };
    expect(sansDonneesSource(JSON.stringify(reponse))).toEqual(reponse);
  });
});
