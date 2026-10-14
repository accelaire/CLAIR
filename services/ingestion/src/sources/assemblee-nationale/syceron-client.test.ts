import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { downloadMock } = vi.hoisted(() => ({ downloadMock: vi.fn() }));
vi.mock('../../utils/download', () => ({ downloadWithRetry: downloadMock }));

import { SyceronClient, oublierArchivesSyceron } from './syceron-client';

const SEANCE = `<?xml version='1.0' encoding='UTF-8'?>
<compteRendu xmlns="http://schemas.assemblee-nationale.fr/referentiel">
  <uid>CRSANR5L17S2027O1N016</uid>
  <seanceRef>RUANR5L17S2027IDS30016</seanceRef>
  <metadonnees>
    <dateSeance>20261009150000000</dateSeance>
    <legislature>17</legislature>
    <etat>complet</etat>
  </metadonnees>
  <contenu>
    <point nivpoint="2" code_grammaire="DISC_ARTICLES_1_1" art="">
      <paragraphe ordre_absolu_seance="1" id_acteur="PA793174" code_grammaire="PAROLE_GENERIQUE" id_syceron="1" valeur="">
        <orateurs><orateur><nom>M. Yannick Monnet</nom><id>793174</id><qualite/></orateur></orateurs>
        <texte>Cet article mérite un débat.</texte>
      </paragraphe>
    </point>
  </contenu>
</compteRendu>`;

let zipSource: string;

// Une vraie archive, construite comme celle du portail (xml/compteRendu/<uid>.xml) :
// le client la décompresse avec `unzip`.
function archiveDeTest(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'syceron-test-'));
  const cr = path.join(dir, 'xml', 'compteRendu');
  fs.mkdirSync(cr, { recursive: true });
  fs.writeFileSync(path.join(cr, 'CRSANR5L17S2027O1N016.xml'), SEANCE);
  const zip = path.join(dir, 'syseron.xml.zip');
  execFileSync('zip', ['-q', '-r', zip, 'xml'], { cwd: dir });
  return zip;
}

async function uids(client: SyceronClient): Promise<string[]> {
  const lus: string[] = [];
  for await (const seance of client.seances()) lus.push(seance.uid);
  return lus;
}

describe('SyceronClient : archive indisponible', () => {
  beforeEach(() => {
    zipSource = archiveDeTest();
    downloadMock.mockReset();
  });

  afterEach(() => {
    oublierArchivesSyceron();
    fs.rmSync(path.dirname(zipSource), { recursive: true, force: true });
  });

  it('relit l’archive déjà téléchargée par le processus quand le portail ne répond plus', async () => {
    downloadMock
      .mockImplementationOnce(async (_url: string, dest: string) => { fs.copyFileSync(zipSource, dest); })
      .mockRejectedValueOnce(new Error('Request failed with status code 503'));

    const client = new SyceronClient(17);
    expect(await uids(client)).toEqual(['CRSANR5L17S2027O1N016']);
    expect(await uids(client)).toEqual(['CRSANR5L17S2027O1N016']);
    expect(downloadMock).toHaveBeenCalledTimes(2);
  });

  it('échoue comme avant sans archive déjà téléchargée', async () => {
    downloadMock.mockRejectedValueOnce(new Error('Request failed with status code 503'));

    await expect(uids(new SyceronClient(17))).rejects.toThrow('Archive syceron indisponible (législature 17)');
  });
});
