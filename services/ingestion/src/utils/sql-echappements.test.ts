import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Prisma reçoit le gabarit « cuit » des `$queryRaw`, `$executeRaw` et
// `Prisma.sql` : un antislash simple y disparaît (`\s` → `s`, `\d` → `d`). Les
// regex d'article du rattachement scrutin ↔ amendement AN, écrites ainsi, n'ont
// jamais rien trouvé jusqu'au 10 octobre 2026 : la contrainte d'article ne
// jouait pas, et des amendements de seconde partie d'une loi de finances se
// rattachaient à des scrutins de première partie. Il faut écrire `\\s`.

const RACINES = [
  path.resolve(__dirname, '..'),
  path.resolve(__dirname, '../../../../apps/api/src'),
];

function fichiers(dossier: string): string[] {
  if (!fs.existsSync(dossier)) return [];
  return fs.readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : fichiers(p);
    return /\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name) ? [p] : [];
  });
}

/** Le corps de chaque gabarit SQL, interpolations `${…}` exclues. */
function gabaritsSql(source: string): { debut: number; corps: string }[] {
  const gabarits: { debut: number; corps: string }[] = [];
  for (const m of source.matchAll(/(\$queryRaw|\$executeRaw|Prisma\.sql)(<[^`]*?>)?`/g)) {
    const debut = m.index! + m[0].length;
    let i = debut;
    let corps = '';
    while (i < source.length) {
      const c = source[i]!;
      if (c === '\\') { corps += source.slice(i, i + 2); i += 2; continue; }
      if (c === '$' && source[i + 1] === '{') {
        let profondeur = 1;
        i += 2;
        while (i < source.length && profondeur > 0) {
          if (source[i] === '{') profondeur++;
          else if (source[i] === '}') profondeur--;
          i++;
        }
        continue;
      }
      if (c === '`') break;
      corps += c;
      i++;
    }
    gabarits.push({ debut, corps });
  }
  return gabarits;
}

describe('échappements dans le SQL brut', () => {
  it("aucun antislash simple dans un gabarit SQL : il disparaît avant d'arriver en base", () => {
    const fautes: string[] = [];
    for (const racine of RACINES) {
      for (const f of fichiers(racine)) {
        const source = fs.readFileSync(f, 'utf8');
        for (const { debut, corps } of gabaritsSql(source)) {
          for (const m of corps.matchAll(/(?<!\\)\\([A-Za-z.()[\]+*?])/g)) {
            const ligne = source.slice(0, debut).split('\n').length + corps.slice(0, m.index).split('\n').length - 1;
            fautes.push(`${path.relative(process.cwd(), f)}:${ligne} \\${m[1]}`);
          }
        }
      }
    }
    expect(fautes).toEqual([]);
  });
});
