import { afterEach, describe, expect, it, vi } from 'vitest';
import { imageDepuisPage, lireImagesCommons, texteDepuisHtml } from './commons-client';

describe('texteDepuisHtml', () => {
  it('retire les balises, décode les entités, resserre les espaces', () => {
    expect(
      texteDepuisHtml('Remi Jouan (<a href="//commons.wikimedia.org/wiki/User:X" title="User:X">CaptainHaddock</a>)'),
    ).toBe('Remi Jouan (CaptainHaddock)');
    expect(texteDepuisHtml('Minist&#232;re &amp; Cie&nbsp;')).toBe('Ministère & Cie');
    expect(texteDepuisHtml('  <span></span> ')).toBeNull();
    expect(texteDepuisHtml(undefined)).toBeNull();
  });
});

describe('imageDepuisPage', () => {
  const page = {
    title: 'File:Pap Ndiaye.jpg',
    imageinfo: [
      {
        thumburl: 'https://thumb.wikimedia.org/x/500px-Pap_Ndiaye.jpg?utm_source=commons.wikimedia.org',
        descriptionurl: 'https://commons.wikimedia.org/wiki/File:Pap_Ndiaye.jpg',
        mime: 'image/jpeg',
        extmetadata: {
          Artist: { value: 'English : This photo has been taken by …' },
          Attribution: { value: 'Matthieu Riegler, CC-by' },
          LicenseShortName: { value: 'CC BY-SA 3.0' },
          LicenseUrl: { value: '//creativecommons.org/licenses/by-sa/3.0' },
        },
      },
    ],
  };

  it("garde la vignette sans paramètres de suivi et préfère le crédit demandé (Attribution)", () => {
    expect(imageDepuisPage('Pap Ndiaye.jpg', page)).toEqual({
      fichier: 'Pap Ndiaye.jpg',
      vignette: 'https://thumb.wikimedia.org/x/500px-Pap_Ndiaye.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Pap_Ndiaye.jpg',
      auteur: 'Matthieu Riegler, CC-by',
      licence: 'CC BY-SA 3.0',
      licenceUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    });
  });

  it("rejette un fichier absent ou qui n'est pas une image", () => {
    expect(imageDepuisPage('a.jpg', { title: 'File:A.jpg', missing: true })).toBeNull();
    expect(imageDepuisPage('a.pdf', { ...page, imageinfo: [{ ...page.imageinfo[0]!, mime: 'application/pdf' }] })).toBeNull();
  });
});

describe('lireImagesCommons', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retrouve le fichier demandé derrière le titre normalisé', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            query: {
              normalized: [{ from: 'File:Pap_Ndiaye.jpg', to: 'File:Pap Ndiaye.jpg' }],
              pages: [{ title: 'File:Pap Ndiaye.jpg', missing: true }],
            },
          }),
        ),
      ),
    );
    const r = await lireImagesCommons(['Pap_Ndiaye.jpg']);
    expect([...r.entries()]).toEqual([['Pap_Ndiaye.jpg', null]]);
  });

  it('lève une erreur sur une réponse en échec', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 403 })));
    await expect(lireImagesCommons(['a.jpg'])).rejects.toThrow('HTTP 403');
  });
});
