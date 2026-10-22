import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const OUTPUT_FILE = path.join(ROOT_DIR, "public", "openapi.json");
// En dev, une spec déjà téléchargée suffit si l'API est injoignable (hors ligne,
// rate limit) : sinon la doc tombe, et `turbo run dev` arrête tous les services
// avec elle. Le build reste strict.
const KEEP_STALE = process.argv.includes("--keep-stale");

const USER_AGENT = "CLAIR-Docs-Exporter/1.0 (https://github.com/accelaire/CLAIR)";
const ATTENTE_MAX_MS = 5 * 60 * 1000;
const INTERVALLE_MS = 10 * 1000;

/** Commit que sert l'API de production (`/health`), ou null s'il est inconnu. */
async function commitDeLApi() {
  try {
    const res = await fetch("https://api.clair.vote/health", { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    return (await res.json()).commit ?? null;
  } catch {
    return null;
  }
}

/**
 * Une fusion sur master déploie en même temps la doc (Vercel, ~30 s) et l'API
 * (Railway, ~1 min 30) : sans attendre, la doc embarquerait la spécification de
 * l'API précédente. On attend donc que l'API ait changé de version, ou qu'elle
 * serve déjà ce commit. Un autre commit que le nôtre suffit aussi : quand des
 * pushes s'enchaînent, Railway peut sauter les intermédiaires.
 *
 * Seulement pour le build de production sur Vercel : une preview de PR n'a pas
 * d'API à attendre. Si l'API n'annonce pas son commit, ou au bout de 5 min, on
 * continue avec la spécification en ligne plutôt que de bloquer la doc.
 */
async function attendreLaNouvelleApi() {
  const notreCommit = process.env.VERCEL_GIT_COMMIT_SHA;
  if (process.env.VERCEL_ENV !== "production" || !notreCommit) return;

  const auDepart = await commitDeLApi();
  if (!auDepart) {
    console.warn("⚠️ L'API n'annonce pas son commit : spécification prise sans attendre.");
    return;
  }
  const debut = Date.now();
  let actuel = auDepart;
  while (actuel === auDepart && actuel !== notreCommit) {
    if (Date.now() - debut > ATTENTE_MAX_MS) {
      console.warn(`⚠️ L'API sert toujours ${auDepart.slice(0, 7)} après 5 min : spécification prise en l'état.`);
      return;
    }
    console.log(`L'API sert ${actuel.slice(0, 7)}, on attend ${notreCommit.slice(0, 7)}...`);
    await new Promise((r) => setTimeout(r, INTERVALLE_MS));
    actuel = (await commitDeLApi()) ?? actuel;
  }
  console.log(`✓ L'API sert ${actuel.slice(0, 7)}.`);
}

async function exportOpenApi() {
  await attendreLaNouvelleApi();
  console.log("Fetching full OpenAPI Swagger spec from https://api.clair.vote/docs/json...");
  try {
    const res = await fetch("https://api.clair.vote/docs/json", {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    data.openapi = "3.0.3";
    data.servers = [
      { url: "https://api.clair.vote", description: "Production (api.clair.vote)" },
      { url: "http://localhost:3001", description: "API locale Fastify (localhost:3001)" },
    ];

    const newPaths = {};
    for (const [routePath, methods] of Object.entries(data.paths || {})) {
      const convertedPath = routePath.replace(/:([a-zA-Z0-9_]+)/g, "{$1}");
      const pathVars = new Set([...convertedPath.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]));
      const sanitizedMethods = {};

      for (const [method, op] of Object.entries(methods)) {
        if (typeof op === "object" && op !== null) {
          const keptParams = [];
          const presentPathVars = new Set();

          for (const p of op.parameters || []) {
            if (p.name === "params" && p.in === "path") continue;
            if (p.in === "path") {
              const varName = p.name;
              if (pathVars.has(varName) && !presentPathVars.has(varName)) {
                p.required = true;
                if (!p.schema) p.schema = { type: "string" };
                keptParams.push(p);
                presentPathVars.add(varName);
              }
            } else {
              keptParams.push(p);
            }
          }

          for (const v of pathVars) {
            if (!presentPathVars.has(v)) {
              keptParams.push({
                name: v,
                in: "path",
                required: true,
                schema: { type: "string" },
              });
            }
          }

          op.parameters = keptParams;
          const rawOpId = op.operationId || `${method}_${convertedPath}`;
          op.operationId = rawOpId.replace(/[^a-zA-Z0-9_]/g, "_");
          sanitizedMethods[method] = op;
        } else {
          sanitizedMethods[method] = op;
        }
      }
      newPaths[convertedPath] = sanitizedMethods;
    }

    data.paths = newPaths;

    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2), "utf-8");
    console.log(`✓ Successfully updated ${OUTPUT_FILE} (${Object.keys(newPaths).length} paths).`);
  } catch (err) {
    if (KEEP_STALE && fs.existsSync(OUTPUT_FILE)) {
      console.warn(`⚠️ OpenAPI spec not refreshed (${err.message}), using the existing ${OUTPUT_FILE}.`);
      return;
    }
    console.error(`❌ Failed to fetch OpenAPI spec from remote API: ${err.message}`);
    process.exit(1);
  }
}

exportOpenApi();
