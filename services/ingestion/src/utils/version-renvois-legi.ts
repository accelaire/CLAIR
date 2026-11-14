/**
 * Version de la détection des renvois au droit en vigueur
 * (workers/renvois-legi.ts). L'augmenter fait recalculer tous les amendements
 * au passage suivant : à faire à chaque changement de règle ou de tisseuse.
 *
 * Module à part, sans Prisma : `checks/data-quality.ts` la lit, et charger le
 * worker instancierait un client Prisma, qui lit `.env` au passage.
 */
export const VERSION_DETECTION = 1;
