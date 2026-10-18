import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// `updated_at` n'est tenu que si chaque table a son trigger dans
// prisma/triggers.sql : Prisma ne connaît pas les triggers, et une table
// ajoutée au schéma sans le sien garderait sa date d'insertion pour toujours.
// Ce test l'attrape en CI ; l'invariant `tables_sans_horodatage` de
// check-quality l'attrape sur une base réelle.

const prismaDir = path.resolve(__dirname, '../../prisma');
const schema = fs.readFileSync(path.join(prismaDir, 'schema.prisma'), 'utf8');
const triggers = fs.readFileSync(path.join(prismaDir, 'triggers.sql'), 'utf8');

const modeles = [...schema.matchAll(/^model (\w+) \{\n([\s\S]*?)^\}/gm)].map(([, nom, corps]) => ({
  nom: nom!,
  table: /@@map\("([^"]+)"\)/.exec(corps!)?.[1] ?? nom!,
  corps: corps!,
}));

describe('horodatage des lignes', () => {
  it('lit bien les modèles du schéma', () => {
    expect(modeles.length).toBeGreaterThanOrEqual(39);
  });

  it.each(modeles.map((m) => [m.nom, m]))('%s porte created_at et updated_at en @default(now())', (_, m) => {
    expect(m.corps).toMatch(/^\s*createdAt\s+DateTime\s+@default\(now\(\)\)/m);
    expect(m.corps).toMatch(/^\s*updatedAt\s+DateTime\s+@default\(now\(\)\)/m);
    // `@updatedAt` écrirait l'horloge du client à chaque update ; la base s'en charge.
    expect(m.corps).not.toMatch(/@updatedAt/);
  });

  it.each(modeles.map((m) => [m.table]))('%s a son trigger clair_set_updated_at', (table) => {
    const motif = new RegExp(
      `CREATE OR REPLACE TRIGGER ${table}_updated_at BEFORE INSERT OR UPDATE ON ${table}\\s+FOR EACH ROW EXECUTE FUNCTION clair_set_updated_at\\(`,
    );
    expect(triggers).toMatch(motif);
  });
});
