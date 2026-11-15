// =============================================================================
// Version de CLAIR annoncée par l'API (/health, OpenAPI)
// =============================================================================

import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Version du dépôt (docs/03-changelog), lue dans `apps/api/package.json`, que
 * `pnpm changelog:prepare` monte à chaque version. `src/` en développement et
 * `dist/` en production sont tous deux un niveau sous `apps/api/`.
 */
export const VERSION: string = (() => {
  try {
    const manifeste = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
    return typeof manifeste.version === 'string' ? manifeste.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
})();
