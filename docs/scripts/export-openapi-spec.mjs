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

async function exportOpenApi() {
  console.log("Fetching full OpenAPI Swagger spec from https://api.clair.vote/docs/json...");
  try {
    const res = await fetch("https://api.clair.vote/docs/json", {
      headers: {
        "User-Agent": "CLAIR-Docs-Exporter/1.0 (https://github.com/accelaire/CLAIR)",
      },
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
