// =============================================================================
// Client des comptes rendus de réunion de commission — Assemblée nationale
// =============================================================================
//
// Source : https://www.assemblee-nationale.fr/dyn/docs/<compteRenduRef>.html
//
// La référence du compte rendu (`CRCANR5L17S2026PO59051N090`) nous vient déjà
// de l'agenda, sur chaque réunion. Elle ouvre une page qui ne porte que le
// titre et un lien vers le PDF : c'est ce PDF qui contient le compte rendu.
//
// POURQUOI ON NE DEVINE PAS L'URL DU PDF. Elle s'écrit
// `/dyn/17/comptes-rendus/<slug>/l17<slug><session><numéro>_compte-rendu.pdf`,
// où `<slug>` est un raccourci d'organe (`cion_lois`, `cion-eco`, `ega`, `ots`,
// `cetiktok`…) qui ne figure nulle part dans nos données et dont la forme varie
// d'un organe à l'autre, tirets et tirets bas mélangés. On lit donc le lien sur
// la page plutôt que de reconstruire une table de correspondance de plus de
// cent entrées qu'il faudrait tenir à jour à chaque commission d'enquête créée.
//
// TOUTES LES RÉUNIONS N'ONT PAS DE PDF. Sur 22 organes sondés, 5 n'en avaient
// aucun — des groupes d'amitié, pour l'essentiel, dont l'agenda porte une
// référence de compte rendu sans que rien ne soit publié. `null` est donc une
// réponse normale, pas une erreur.
// =============================================================================

import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { errorMessage, httpStatus } from '../../utils/errors';

const BASE_URL = 'https://www.assemblee-nationale.fr';
const DELAI_ENTRE_REQUETES_MS = 350;

/** Le lien vers le PDF, tel qu'il est écrit dans la page de notice. */
const LIEN_PDF = /href="(\/dyn\/[^"]*_compte-rendu\.pdf)"/u;

export interface CompteRenduTelecharge {
  /** L'URL du PDF, à conserver comme `sourceUrl` des interventions. */
  url: string;
  /** Le texte rendu par `pdftotext -layout`. */
  texte: string;
}

export class ComptesRendusCommissionClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: BASE_URL,
      timeout: 60_000,
      // Sans timeout explicite, un conteneur d'ingestion peut rester bloqué
      // toute la nuit sur une requête qui ne répond jamais.
      headers: { 'User-Agent': 'CLAIR/1.0 (+https://clair.vote)' },
      maxRedirects: 5,
    });
    logger.info('ComptesRendusCommissionClient initialized');
  }

  private async pause(): Promise<void> {
    await new Promise((r) => setTimeout(r, DELAI_ENTRE_REQUETES_MS));
  }

  /**
   * L'URL du PDF d'un compte rendu, ou `null` quand rien n'est publié.
   */
  async urlDuPdf(compteRenduRef: string): Promise<string | null> {
    try {
      const { data } = await this.http.get<string>(`/dyn/docs/${compteRenduRef}.html`, {
        responseType: 'text',
      });
      const lien = LIEN_PDF.exec(data);
      return lien ? `${BASE_URL}${lien[1]}` : null;
    } catch (err) {
      logger.warn(
        { compteRenduRef, status: httpStatus(err), error: errorMessage(err) },
        'Notice de compte rendu de commission inaccessible'
      );
      return null;
    }
  }

  /**
   * Le texte d'un compte rendu, ou `null` si rien n'est publié ou lisible.
   *
   * `pdftotext -layout` conserve l'indentation, dont le parseur a besoin pour
   * délimiter les paragraphes ; sans `-layout`, tout revient en colonne 0 et
   * les en-têtes d'orateur coupés sur deux lignes deviennent introuvables.
   */
  async texteDuCompteRendu(compteRenduRef: string): Promise<CompteRenduTelecharge | null> {
    const url = await this.urlDuPdf(compteRenduRef);
    if (!url) return null;
    await this.pause();

    const dossier = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'clair-cr-'));
    const pdf = path.join(dossier, 'cr.pdf');
    const txt = path.join(dossier, 'cr.txt');
    try {
      const { data } = await this.http.get<ArrayBuffer>(url.slice(BASE_URL.length), {
        responseType: 'arraybuffer',
      });
      await fs.promises.writeFile(pdf, Buffer.from(data));

      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      await promisify(execFile)('pdftotext', ['-layout', '-enc', 'UTF-8', pdf, txt], {
        timeout: 120_000,
      });

      return { url, texte: await fs.promises.readFile(txt, 'utf8') };
    } catch (err) {
      logger.warn(
        { compteRenduRef, url, error: errorMessage(err) },
        'Compte rendu de commission illisible'
      );
      return null;
    } finally {
      await fs.promises.rm(dossier, { recursive: true, force: true }).catch(() => undefined);
      await this.pause();
    }
  }
}
