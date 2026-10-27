import { writeFileSync } from "node:fs";
import { tokensCss } from "../src/css.ts";

const target = new URL("../src/tokens.css", import.meta.url);
writeFileSync(target, tokensCss());
console.log(`✓ ${target.pathname}`);
