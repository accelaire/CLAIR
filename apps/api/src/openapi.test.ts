import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { INTERNAL_SECURITY_SCHEME, OPENAPI_TAGS, PUBLIC_API_URL, openapiDocument } from './openapi';
import { INTERNAL_HEADER } from './utils/internal-auth';

/** Tags écrits en clair dans les contrôleurs (`tags: ['Scrutins']`). */
function tagsDesControleurs(): Set<string> {
  const modules = path.join(__dirname, 'modules');
  const tags = new Set<string>();
  for (const dossier of readdirSync(modules)) {
    for (const fichier of readdirSync(path.join(modules, dossier))) {
      if (!fichier.endsWith('.controller.ts')) continue;
      const source = readFileSync(path.join(modules, dossier, fichier), 'utf-8');
      for (const m of source.matchAll(/tags:\s*\[\s*'([^']+)'\s*\]/g)) if (m[1]) tags.add(m[1]);
    }
  }
  return tags;
}

describe('openapiDocument', () => {
  it("annonce l'adresse publique en production, même si API_URL vaut l'URL de l'hébergeur", () => {
    const doc = openapiDocument(true, 'https://clair-production.up.railway.app');
    expect(doc.servers).toEqual([{ url: PUBLIC_API_URL, description: 'Production' }]);
  });

  it('annonce API_URL, ou localhost par défaut, hors production', () => {
    expect(openapiDocument(false, 'http://localhost:4000').servers[0]?.url).toBe('http://localhost:4000');
    expect(openapiDocument(false, undefined).servers[0]?.url).toBe('http://localhost:3001');
  });

  it("déclare le jeton interne comme une clé d'en-tête, sans valeur", () => {
    const schema = openapiDocument(true, undefined).components.securitySchemes[INTERNAL_SECURITY_SCHEME];
    expect(schema).toMatchObject({ type: 'apiKey', in: 'header', name: INTERNAL_HEADER });
    expect(JSON.stringify(schema)).not.toMatch(/example|default|value/i);
  });

  it('déclare chaque tag utilisé par un contrôleur', () => {
    const declares = new Set(OPENAPI_TAGS.map((t) => t.name));
    // Les trois préfixes des parlementaires passent leur tag par une variable.
    const lus = tagsDesControleurs();
    expect(lus.size).toBeGreaterThan(10); // la lecture des contrôleurs a bien trouvé leurs tags
    const utilises = [...lus, 'Parlementaires', 'Députés', 'Sénateurs'];
    expect(utilises.filter((t) => !declares.has(t))).toEqual([]);
  });
});
