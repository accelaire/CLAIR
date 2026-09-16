// =============================================================================
// Client syceron - Comptes rendus de séance de l'Assemblée nationale
// Source: https://data.assemblee-nationale.fr/static/openData/repository/{legislature}/vp/syceronbrut/syseron.xml.zip
// =============================================================================
//
// Remplace le client DILA, dont la source ne publie plus depuis janvier 2026
// (13 archives pour toute l'année 2026, contre 219 séances ici).
//
// L'archive est publiée d'un bloc par législature — une cinquantaine de Mo,
// trois cents décompressés — et regénérée chaque nuit. On la télécharge en
// entier, mais on ne parse que les séances demandées : la moisson quotidienne
// n'a besoin que de celles absentes de la base.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { errorMessage } from '../../utils/errors';
import { downloadWithRetry } from '../../utils/download';
import { parseCompteRendu, type SeanceSyceron } from './syceron-parser';

const BASE_URL = 'https://data.assemblee-nationale.fr/static/openData/repository';

export interface SyceronOptions {
  /** Ne parser que ces séances (leur `uid`). Vide ou absent : toutes. */
  seulement?: Set<string>;
  /** Ignorer ces séances : celles déjà en base, pour la moisson quotidienne. */
  ignorer?: Set<string>;
  /** Borne de sécurité pour les essais en local. */
  maxSeances?: number;
  /** Réutiliser une archive déjà décompressée au lieu de la retélécharger. */
  repertoireLocal?: string;
}

export class SyceronClient {
  constructor(private readonly legislature: number) {
    logger.info({ legislature }, 'SyceronClient initialized');
  }

  private get url(): string {
    return `${BASE_URL}/${this.legislature}/vp/syceronbrut/syseron.xml.zip`;
  }

  /**
   * Parcourt les comptes rendus un par un.
   *
   * Générateur volontairement : les 601 séances de la 17e législature pèsent
   * 311 Mo décompressés et près de 300 000 prises de parole. Les matérialiser
   * toutes en mémoire avant d'écrire exposerait le conteneur d'ingestion au
   * même OOM que le reste du pipeline.
   */
  async *seances(options: SyceronOptions = {}): AsyncGenerator<SeanceSyceron> {
    const { repertoire, nettoyage } = await this.preparerArchive(options);

    try {
      const fichiers = (await fs.promises.readdir(repertoire))
        .filter((f) => f.endsWith('.xml'))
        .sort();

      logger.info({ fichiers: fichiers.length, legislature: this.legislature }, 'Comptes rendus disponibles');

      let lues = 0;
      let ignorees = 0;
      let illisibles = 0;

      for (const fichier of fichiers) {
        if (options.maxSeances && lues >= options.maxSeances) break;

        // Le `uid` de la séance est le nom du fichier : on filtre avant de lire
        // le XML, pour ne pas payer le parsing d'une séance déjà connue.
        const uid = path.basename(fichier, '.xml');
        if (options.seulement && !options.seulement.has(uid)) continue;
        if (options.ignorer?.has(uid)) {
          ignorees++;
          continue;
        }

        let seance: SeanceSyceron | null = null;
        try {
          const xml = await fs.promises.readFile(path.join(repertoire, fichier), 'utf-8');
          seance = parseCompteRendu(xml);
        } catch (error) {
          logger.warn({ fichier, error: errorMessage(error) }, 'Compte rendu illisible');
        }

        if (!seance) {
          illisibles++;
          continue;
        }

        lues++;
        yield seance;
      }

      logger.info({ lues, ignorees, illisibles, legislature: this.legislature }, 'Comptes rendus parcourus');
    } finally {
      await nettoyage();
    }
  }

  /**
   * Rend un répertoire de comptes rendus prêt à lire, et de quoi le libérer.
   *
   * Une archive déjà décompressée sur le disque (`repertoireLocal`) évite de
   * retélécharger 53 Mo à chaque essai en développement.
   */
  private async preparerArchive(
    options: SyceronOptions,
  ): Promise<{ repertoire: string; nettoyage: () => Promise<void> }> {
    if (options.repertoireLocal) {
      logger.info({ repertoire: options.repertoireLocal }, 'Archive locale réutilisée');
      return { repertoire: options.repertoireLocal, nettoyage: async () => {} };
    }

    const temp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'clair-syceron-'));
    const nettoyage = async (): Promise<void> => {
      await fs.promises.rm(temp, { recursive: true, force: true }).catch(() => {});
    };

    try {
      const zip = path.join(temp, 'syceron.zip');
      logger.info({ url: this.url }, 'Téléchargement de l’archive des comptes rendus...');
      await downloadWithRetry(this.url, zip);

      const extrait = path.join(temp, 'extrait');
      await fs.promises.mkdir(extrait, { recursive: true });

      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      await execAsync(`unzip -q -o "${zip}" -d "${extrait}"`, { maxBuffer: 1024 * 1024 * 50 });

      // L'archive range les séances sous xml/compteRendu/.
      const attendu = path.join(extrait, 'xml', 'compteRendu');
      const repertoire = fs.existsSync(attendu) ? attendu : extrait;

      // Le zip n'est plus utile une fois décompressé, et il pèse autant que le
      // reste : sur le volume de production, ces 53 Mo comptent.
      await fs.promises.rm(zip, { force: true }).catch(() => {});

      return { repertoire, nettoyage };
    } catch (error) {
      await nettoyage();
      throw new Error(`Archive syceron indisponible (législature ${this.legislature}) : ${errorMessage(error)}`);
    }
  }
}

export default SyceronClient;
