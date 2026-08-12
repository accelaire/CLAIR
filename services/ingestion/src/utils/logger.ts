// =============================================================================
// Logger pour le service d'ingestion
// =============================================================================
//
// Railway dérive le niveau d'un log du FLUX sur lequel il arrive et écrase le
// champ `level` du JSON. Pino écrivant tout sur stdout, 100 % des lignes
// remontaient en `info` — y compris les 2 078 `logger.error` du run du
// 2026-07-26. Aucune alerte ne pouvait se déclencher, et sept jours de panne
// des amendements AN sont passés inaperçus.
//
// Deux correctifs, complémentaires :
//  1. En production, warn et au-delà partent sur stderr (Railway les classe
//     alors en erreur). `dedupe: true` garantit qu'une ligne ne part que sur
//     un seul flux, sans quoi les erreurs seraient écrites en double.
//  2. Un champ `severity` porte le niveau en clair. Contrairement à `level`,
//     Railway ne le connaît pas, donc ne l'écrase pas : il reste filtrable
//     dans les logs quoi qu'il arrive.
// =============================================================================

import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

const level = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

const baseOptions: pino.LoggerOptions = {
  level,
  formatters: {
    level: (label, number) => ({ level: number, severity: label.toUpperCase() }),
  },
};

export const logger = isProduction
  ? pino(
      baseOptions,
      pino.multistream(
        [
          { level, stream: process.stdout },
          { level: 'warn', stream: process.stderr },
        ],
        { dedupe: true },
      ),
    )
  : pino({
      ...baseOptions,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    });

export default logger;
