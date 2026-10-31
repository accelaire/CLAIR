import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import * as tarStream from 'tar-stream';
import { describe, it, expect } from 'vitest';
import {
  analyserCheminLegi,
  dateLegi,
  horodatageArchive,
  lireArticle,
  lireFichierArchiveLegi,
  lireListeArchives,
  lireSuppressions,
  lireVersionTexte,
  type ElementLegi,
} from './legi-client';

// Chemins et XML repris de l'incrément LEGI_20261024-214209 de la DILA,
// réduits aux balises lues (le contenu des articles est ignoré).

const CHEMIN_ARTICLE =
  'legi/global/code_et_TNC_non_vigueur/TNC_non_vigueur/JORF/TEXT/00/00/00/76/20/JORFTEXT000000762078/article/LEGI/ARTI/00/00/51/86/57/LEGIARTI000051865798';
const CHEMIN_VERSION =
  'legi/global/code_et_TNC_non_vigueur/TNC_non_vigueur/JORF/TEXT/00/00/00/52/17/JORFTEXT000000521765/texte/version/LEGITEXT000006060968';
const CHEMIN_DOSSIER =
  'legi/global/code_et_TNC_en_vigueur/TNC_en_vigueur/JORF/TEXT/00/00/00/76/20/JORFTEXT000000762078';

const XML_ARTICLE = `<?xml version="1.0" encoding="UTF-8"?>
<ARTICLE>
<META>
<META_COMMUN>
<ID>LEGIARTI000051865798</ID>
<ANCIEN_ID/>
<ORIGINE>LEGI</ORIGINE>
<NATURE>Article</NATURE>
</META_COMMUN>
<META_SPEC>
<META_ARTICLE>
<NUM>L121-1</NUM>
<ETAT>ABROGE</ETAT>
<DATE_DEBUT>1999-10-04</DATE_DEBUT>
<DATE_FIN>2026-10-25</DATE_FIN>
<TYPE>AUTONOME</TYPE>
</META_ARTICLE>
</META_SPEC>
</META>
<CONTEXTE>
<TEXTE autorite="" cid="JORFTEXT000000762078" date_publi="1999-10-03" ministere="MINISTERE DE L'EQUIPEMENT" nature="ARRETE" nor="EQUA9900919A" num="">
<TITRE_TXT c_titre_court="Arrêté du 29 septembre 1999" debut="2999-01-01" fin="2999-01-01" id_txt="JORFTEXT000000762078">Arrêté du 29 septembre 1999 portant restriction d'usage de l'aérodrome de Paris-Orly</TITRE_TXT>
</TEXTE>
</CONTEXTE>
<VERSIONS>
<VERSION etat="ABROGE">
<LIEN_ART debut="1999-10-04" etat="ABROGE" fin="2026-10-25" id="LEGIARTI000051865798" num="" origine="LEGI"/>
</VERSION>
</VERSIONS>
</ARTICLE>
`;

const XML_VERSION = `<?xml version="1.0" encoding="UTF-8"?>
<TEXTE_VERSION>
<META>
<META_COMMUN>
<ID>LEGITEXT000006060968</ID>
<ANCIEN_ID>MRH02</ANCIEN_ID>
<ORIGINE>LEGI</ORIGINE>
<NATURE>DECRET</NATURE>
</META_COMMUN>
<META_SPEC>
<META_TEXTE_CHRONICLE>
<CID>JORFTEXT000000521765</CID>
<NUM>60-516</NUM>
<NUM_PARUTION/>
<NUM_SEQUENCE>0</NUM_SEQUENCE>
<DATE_PUBLI>1960-06-03</DATE_PUBLI>
<DATE_TEXTE>1960-06-02</DATE_TEXTE>
</META_TEXTE_CHRONICLE>
<META_TEXTE_VERSION>
<TITRE>Décret n°60-516 du 2 juin 1960</TITRE>
<TITREFULL>Décret n°60-516 du 2 juin 1960 portant harmonisation des
circonscriptions administratives &amp; autres.</TITREFULL>
<ETAT>ABROGE</ETAT>
<DATE_DEBUT>1960-06-03</DATE_DEBUT>
<DATE_FIN>2017-01-01</DATE_FIN>
</META_TEXTE_VERSION>
</META_SPEC>
</META>
</TEXTE_VERSION>
`;

describe('archives listées', () => {
  it('sépare dumps globaux et incréments, dans l’ordre chronologique', () => {
    const html = `
      <a href="LEGI_20261024-214209.tar.gz">LEGI_20261024-214209.tar.gz</a>
      <a href="Freemium_legi_global_20250713-140000.tar.gz">Freemium…</a>
      <a href="LEGI_20250713-205013.tar.gz">LEGI_20250713-205013.tar.gz</a>
      <a href="LEGI_20250712-211706.tar.gz">LEGI_20250712-211706.tar.gz</a>
      <a href="LEGI_20250712-211706.tar.gz">doublon</a>
      <a href="../">Parent Directory</a>`;
    expect(lireListeArchives(html)).toEqual({
      globaux: ['Freemium_legi_global_20250713-140000.tar.gz'],
      increments: [
        'LEGI_20250712-211706.tar.gz',
        'LEGI_20250713-205013.tar.gz',
        'LEGI_20261024-214209.tar.gz',
      ],
    });
  });

  it('ordonne globaux et incréments sur un même horodatage', () => {
    expect(horodatageArchive('Freemium_legi_global_20250713-140000.tar.gz')).toBe('20250713-140000');
    expect(horodatageArchive('LEGI_20250713-205013.tar.gz') > '20250713-140000').toBe(true);
    expect(() => horodatageArchive('LEGI.tar.gz')).toThrow();
  });
});

describe('analyserCheminLegi', () => {
  it('reconnaît un article, avec ou sans le préfixe daté des incréments', () => {
    const attendu = { type: 'article', id: 'LEGIARTI000051865798', conteneur: 'JORFTEXT000000762078' };
    expect(analyserCheminLegi(CHEMIN_ARTICLE)).toEqual(attendu);
    expect(analyserCheminLegi(`20261024-214209/${CHEMIN_ARTICLE}.xml`)).toEqual(attendu);
  });

  it('reconnaît une version de texte et un dossier', () => {
    expect(analyserCheminLegi(`${CHEMIN_VERSION}.xml`)).toEqual({
      type: 'version_texte',
      id: 'LEGITEXT000006060968',
      conteneur: 'JORFTEXT000000521765',
    });
    expect(analyserCheminLegi(CHEMIN_DOSSIER)).toEqual({ type: 'dossier', conteneur: 'JORFTEXT000000762078' });
  });

  it('range un article d’un dossier de section sous ce dossier', () => {
    expect(
      analyserCheminLegi(
        'legi/global/code_et_TNC_en_vigueur/TNC_en_vigueur/JORF/SCTA/00/00/12/34/56/JORFSCTA000012345678/article/LEGI/ARTI/00/00/06/41/66/LEGIARTI000006416655',
      ),
    ).toEqual({ type: 'article', id: 'LEGIARTI000006416655', conteneur: 'JORFSCTA000012345678' });
  });

  it('ignore la structure, les sections et le reste', () => {
    expect(analyserCheminLegi(CHEMIN_VERSION.replace('/version/', '/struct/')).type).toBe('autre');
    expect(
      analyserCheminLegi(
        'legi/global/code_et_TNC_en_vigueur/code_en_vigueur/LEGI/TEXT/00/00/06/07/07/LEGITEXT000006070721/section_ta/LEGI/SCTA/00/00/06/11/48/LEGISCTA000006114830.xml',
      ).type,
    ).toBe('autre');
    expect(analyserCheminLegi('20261024-214209/liste_suppression_legi_dossier.dat').type).toBe('autre');
  });
});

describe('lireSuppressions', () => {
  it('retire articles et versions de textes, pas la structure', () => {
    const contenu = `${CHEMIN_ARTICLE}\n\n${CHEMIN_VERSION}\n${CHEMIN_VERSION.replace('/version/', '/struct/')}\r\n`;
    expect(lireSuppressions(contenu)).toEqual([
      { type: 'article', id: 'LEGIARTI000051865798', conteneur: 'JORFTEXT000000762078' },
      { type: 'version_texte', id: 'LEGITEXT000006060968', conteneur: 'JORFTEXT000000521765' },
    ]);
  });

  it('ne retire rien pour un dossier déplacé', () => {
    expect(lireSuppressions(`${CHEMIN_DOSSIER} D\n`)).toEqual([]);
  });
});

describe('lecture des XML', () => {
  it('lit un article et le texte qui le contient', () => {
    expect(lireArticle(XML_ARTICLE, 'JORFTEXT000000762078')).toEqual({
      id: 'LEGIARTI000051865798',
      cid: 'JORFTEXT000000762078',
      natureTexte: 'ARRETE',
      num: 'L121-1',
      etat: 'ABROGE',
      dateDebut: '1999-10-04',
      dateFin: '2026-10-25',
    });
  });

  it('prend une balise vide pour vide, sans aller chercher plus loin', () => {
    const sansNumero = XML_ARTICLE.replace('<NUM>L121-1</NUM>', '<NUM/>') + '<NUM>leurre</NUM>';
    expect(lireArticle(sansNumero, 'JORFTEXT000000762078')?.num).toBeNull();
  });

  it('lit une version de texte, titre complet décodé sur une ligne', () => {
    expect(lireVersionTexte(XML_VERSION)).toEqual({
      id: 'LEGITEXT000006060968',
      cid: 'JORFTEXT000000521765',
      nature: 'DECRET',
      num: '60-516',
      dateTexte: '1960-06-02',
      dateDebut: '1960-06-03',
      dateFin: '2017-01-01',
      etat: 'ABROGE',
      titre: 'Décret n°60-516 du 2 juin 1960 portant harmonisation des circonscriptions administratives & autres.',
    });
  });

  it('se rabat sur le titre court', () => {
    const v = lireVersionTexte(XML_VERSION.replace(/<TITREFULL>[\s\S]*<\/TITREFULL>/, '<TITREFULL/>'));
    expect(v?.titre).toBe('Décret n°60-516 du 2 juin 1960');
  });

  it('prend le dossier pour texte d’un article sans contexte (Déclaration de 1789)', () => {
    const sansContexte = XML_ARTICLE.replace(/<CONTEXTE>[\s\S]*<\/CONTEXTE>/, '');
    expect(lireArticle(sansContexte, 'JORFTEXT000000697056')).toMatchObject({
      cid: 'JORFTEXT000000697056',
      natureTexte: null,
    });
    expect(lireArticle(sansContexte, 'JORFSCTA000012345678')).toBeNull();
  });

  it('écarte un fichier sans identifiant ou sans texte', () => {
    expect(lireArticle(XML_ARTICLE.replace('<ID>LEGIARTI000051865798</ID>', '<ID/>'), 'JORFTEXT000000762078')).toBeNull();
    expect(lireVersionTexte(XML_VERSION.replace('<CID>JORFTEXT000000521765</CID>', '<CID/>'))).toBeNull();
  });

  it('ne garde que des dates valides', () => {
    expect(dateLegi('2999-01-01')).toBe('2999-01-01');
    expect(dateLegi('2222-02-22')).toBe('2222-02-22');
    expect(dateLegi('2025-02-30')).toBeNull();
    expect(dateLegi('0000-00-00')).toBeNull();
    expect(dateLegi(null)).toBeNull();
  });
});

describe('lireFichierArchiveLegi', () => {
  it('parcourt une archive aux chemins longs comme celles de la DILA, sans lire les dossiers déplacés', async () => {
    const pack = tarStream.pack();
    const prefixe = '20261024-214209/';
    pack.entry({ name: prefixe, type: 'directory' });
    pack.entry({ name: `${prefixe}liste_suppression_legi_dossier.dat` }, `${CHEMIN_DOSSIER} D\n`);
    pack.entry({ name: `${prefixe}liste_suppression_legi.dat` }, `${CHEMIN_ARTICLE}\n`);
    pack.entry({ name: `${prefixe}${CHEMIN_ARTICLE}.xml` }, XML_ARTICLE);
    pack.entry({ name: `${prefixe}${CHEMIN_VERSION}.xml` }, XML_VERSION);
    pack.entry({ name: `${prefixe}${CHEMIN_VERSION.replace('/version/', '/struct/')}.xml` }, '<TEXTELR/>');
    pack.finalize();

    const dossier = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'legi-test-'));
    const fichier = path.join(dossier, 'LEGI_20261024-214209.tar.gz');
    try {
      await new Promise<void>((ok, ko) => {
        pack.pipe(zlib.createGzip()).pipe(fs.createWriteStream(fichier)).on('finish', ok).on('error', ko);
      });
      const vus: ElementLegi[] = [];
      const n = await lireFichierArchiveLegi(fichier, (e) => {
        vus.push(e);
      });
      expect(n).toBe(5);
      expect(vus.map((e) => e.type)).toEqual(['suppression', 'article', 'texte']);
      expect(vus[1]).toMatchObject({ type: 'article', article: { id: 'LEGIARTI000051865798' } });
    } finally {
      await fs.promises.rm(dossier, { recursive: true, force: true });
    }
  });
});
