// Ports des applications construites pendant les tests. Hors des ports de dev (3000-3010) :
// avec `reuseExistingServer`, un serveur de dev oublié serait testé à la place du build.
// `api` : faux serveur d'API du site (e2e/fake-api.mjs), jamais l'API de production.
export const E2E_PORTS = { site: 4310, docs: 4311, api: 4312 } as const;
