// =============================================================================
// Le texte dont relève une section de débat du Sénat
// =============================================================================
// Source: https://data.senat.fr/data/dosleg/dosleg.zip
// =============================================================================
//
// Une journée de séance du Sénat discute jusqu'à six textes. L'index des débats
// rattache chaque section à une « lecture » (`lecassidt`), un identifiant
// interne qu'il n'explique pas. Sans lui donner un sens, un scrutin ramasse le
// débat des autres textes du jour : 283 des 716 rattachements mesurés mêlaient
// ainsi plusieurs textes — le rattachement grossier qu'on a précisément retiré
// côté Assemblée.
//
// DOSLEG porte la chaîne qui manque, en trois tables :
//
//   lecass   (lecassidt, lecidt, …)  la lecture dans une assemblée
//   lecture  (lecidt, loicod, …)     la lecture dans la navette
//   loi      (loicod, …, signet, …)  le dossier législatif
//
// `signet` est la référence que nos dossiers portent déjà, préfixée : le
// dossier `SENAT-ppl24-724` est la loi de signet `ppl24-724`. Sur les 420
// lectures discutées pendant la période couverte par nos comptes rendus, 97 %
// se résolvent ainsi jusqu'à un dossier connu.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';
import { logger } from '../../utils/logger';
import { errorMessage } from '../../utils/errors';
import { downloadWithRetry } from '../../utils/download';

const URL_DOSLEG = 'https://data.senat.fr/data/dosleg/dosleg.zip';

/** Préfixe des `uid` de dossiers du Sénat, posé à l'ingestion des dossiers. */
const PREFIXE_DOSSIER = 'SENAT-';

export interface OptionsLectures {
  /** Dump déjà décompressé, pour les essais en local et pour éviter un second téléchargement. */
  cheminLocal?: string;
}

/** Une ligne `COPY` du dump, découpée. `\N` devient `null`. */
export function champsDeLigneDosleg(ligne: string): (string | null)[] {
  return ligne.split('\t').map((c) => (c === '\\N' ? null : c.trim()));
}

export class SenatLecturesClient {
  /**
   * `lecassidt` → `uid` du dossier législatif.
   *
   * Les trois tables sont lues en une seule traversée du dump : il pèse 121 Mo
   * et `loi` compte 12 429 lignes, il n'y a pas de raison de le parcourir trois
   * fois.
   */
  async lecturesVersDossier(options: OptionsLectures = {}): Promise<Map<string, string>> {
    const { chemin, nettoyage } = await this.preparer(options.cheminLocal);

    try {
      const lecassVersLecidt = new Map<string, string>();
      const lecidtVersLoicod = new Map<string, string>();
      const loicodVersSignet = new Map<string, string>();

      await this.parcourirTables(chemin, {
        // lecass (lecassidt, lecidt, codass, …)
        lecass: (c) => {
          if (c[0] && c[1]) lecassVersLecidt.set(c[0], c[1]);
        },
        // lecture (lecidt, loicod, typleccod, leccom)
        lecture: (c) => {
          if (c[0] && c[1]) lecidtVersLoicod.set(c[0], c[1]);
        },
        // loi (loicod, typloicod, etaloicod, deccoccod, numero, signet, …)
        loi: (c) => {
          if (c[0] && c[5]) loicodVersSignet.set(c[0], c[5]);
        },
      });

      const table = new Map<string, string>();
      let sansLecture = 0;
      let sansSignet = 0;
      for (const [lecassidt, lecidt] of lecassVersLecidt) {
        const loicod = lecidtVersLoicod.get(lecidt);
        if (!loicod) {
          sansLecture++;
          continue;
        }
        const signet = loicodVersSignet.get(loicod);
        if (!signet) {
          sansSignet++;
          continue;
        }
        table.set(lecassidt, `${PREFIXE_DOSSIER}${signet}`);
      }

      logger.info(
        {
          lectures: lecassVersLecidt.size,
          resolues: table.size,
          sansLecture,
          sansSignet,
        },
        'Lectures du Sénat résolues vers leur dossier',
      );
      return table;
    } finally {
      await nettoyage();
    }
  }

  /**
   * Lit plusieurs tables du dump en une passe.
   *
   * On ne s'arrête qu'une fois toutes les tables demandées traversées : leur
   * ordre dans le dump n'est pas garanti, et `lecass` y précède `lecture`.
   */
  private async parcourirTables(
    chemin: string,
    surLigne: Record<string, (champs: (string | null)[]) => void>,
  ): Promise<void> {
    const flux = readline.createInterface({
      input: fs.createReadStream(chemin, { encoding: 'utf-8' }),
      crlfDelay: Infinity,
    });

    const restantes = new Set(Object.keys(surLigne));
    let courante: string | null = null;

    for await (const ligne of flux) {
      if (courante === null) {
        if (!ligne.startsWith('COPY ')) continue;
        const nom = ligne.match(/^COPY (\w+) \(/)?.[1];
        if (nom && restantes.has(nom)) courante = nom;
        continue;
      }
      if (ligne === '\\.') {
        restantes.delete(courante);
        courante = null;
        if (restantes.size === 0) break;
        continue;
      }
      surLigne[courante]!(champsDeLigneDosleg(ligne));
    }

    flux.close();
    if (restantes.size > 0) {
      logger.warn({ tables: [...restantes] }, 'Tables absentes du dump DOSLEG');
    }
  }

  private async preparer(cheminLocal?: string): Promise<{ chemin: string; nettoyage: () => Promise<void> }> {
    if (cheminLocal) {
      logger.info({ chemin: cheminLocal }, 'Dump DOSLEG réutilisé');
      return { chemin: cheminLocal, nettoyage: async () => {} };
    }

    const temp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'clair-senat-dosleg-'));
    const nettoyage = async (): Promise<void> => {
      await fs.promises.rm(temp, { recursive: true, force: true }).catch(() => {});
    };

    try {
      const zip = path.join(temp, 'dosleg.zip');
      logger.info({ url: URL_DOSLEG }, 'Téléchargement du dossier législatif Sénat...');
      await downloadWithRetry(URL_DOSLEG, zip);

      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      await execAsync(`unzip -q -o "${zip}" -d "${temp}"`, { maxBuffer: 1024 * 1024 * 50 });
      await fs.promises.rm(zip, { force: true }).catch(() => {});

      return { chemin: path.join(temp, 'dosleg.sql'), nettoyage };
    } catch (error) {
      await nettoyage();
      throw new Error(`Dossier législatif Sénat indisponible : ${errorMessage(error)}`);
    }
  }
}

export default SenatLecturesClient;
