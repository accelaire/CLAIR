import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Stabilité des slugs qui servent d'URL publique.
 *
 * Le slug d'un parlementaire (`/deputes/<slug>`, `/senateurs/<slug>`) et celui
 * d'un groupe (`/groupes/<chambre>/<slug>`) sont dérivés d'un texte de la source
 * amont : prénom + nom, ou le sigle du groupe. Ils étaient réécrits à chaque
 * passe de synchronisation, donc chaque nuit. Une correction d'accent, un nom
 * d'usage ajouté ou un sigle modifié en amont suffisait à tuer l'URL au matin.
 *
 * Il n'existe aucune table de redirection pour les pages de personnes et de
 * groupes — le filet posé pour les sujets ne couvre qu'eux. Une URL perdue ici
 * l'est définitivement. Le slug est donc posé à la création, et plus jamais
 * retouché.
 *
 * Ces fonctions ne sont pas exportées et écrivent en base : le test porte sur le
 * texte source. L'invariant vit dans la forme du payload de mise à jour, c'est
 * donc là qu'on le vérifie.
 */
const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'sync.ts'), 'utf-8');

/**
 * Renvoie l'argument d'un appel, accolades équilibrées.
 *
 * Une expression régulière paresseuse ne convient pas : `[\s\S]*?slug:` déborde
 * sur l'appel suivant et signale un `create` voisin comme s'il s'agissait de
 * l'`update` examiné. Le comptage d'accolades s'arrête à la bonne frontière.
 */
function argumentDeLAppel(source: string, indexParenthese: number): string {
  let profondeur = 0;
  for (let i = indexParenthese; i < source.length; i++) {
    const c = source[i];
    if (c === '(' || c === '{' || c === '[') profondeur++;
    else if (c === ')' || c === '}' || c === ']') {
      profondeur--;
      if (profondeur === 0) return source.slice(indexParenthese, i + 1);
    }
  }
  throw new Error('Appel non refermé dans sync.ts');
}

/** Tous les appels `prisma.<modele>.<methode>(...)`, argument compris. */
function appels(modele: string, methode: string): string[] {
  const trouves: string[] = [];
  const marqueur = `prisma.${modele}.${methode}(`;
  let depuis = 0;
  for (;;) {
    const i = src.indexOf(marqueur, depuis);
    if (i === -1) return trouves;
    trouves.push(argumentDeLAppel(src, i + marqueur.length - 1));
    depuis = i + marqueur.length;
  }
}

describe('stabilité des slugs d’URL publique', () => {
  it('ne réécrit jamais le slug d’un parlementaire à la mise à jour', () => {
    const fautifs = appels('parlementaire', 'update').filter((a) => /\bslug:/.test(a));
    expect(
      fautifs,
      'Un update de parlementaire repose un slug. L’URL /deputes/<slug> redevient ' +
        'révocable à chaque nuit, sans redirection pour la rattraper.',
    ).toEqual([]);
  });

  it('ne réécrit jamais le slug d’un groupe à la mise à jour', () => {
    const fautifs = appels('groupePolitique', 'update').filter((a) => /\bslug:/.test(a));
    expect(
      fautifs,
      'Un update de groupe repose un slug. L’URL /groupes/<chambre>/<slug> suit ' +
        'alors le sigle de la source et meurt au premier renommage.',
    ).toEqual([]);
  });

  it('pose toujours un slug à la création', () => {
    // Le slug est @unique et non nullable : une création sans slug casse en base.
    // Les créations qui passent un objet déjà constitué (`create({ data })`) sont
    // couvertes par le test de destructuration, qui vérifie que seul le chemin de
    // mise à jour l'écarte.
    for (const modele of ['parlementaire', 'groupePolitique'] as const) {
      const inline = appels(modele, 'create').filter((a) => /data:\s*\{/.test(a));
      expect(inline.length, `aucune création inline trouvée pour ${modele}`).toBeGreaterThan(0);
      for (const appel of inline) {
        expect(
          /\bslug:/.test(appel),
          `Une création de ${modele} ne pose pas de slug : la colonne est @unique et requise.`,
        ).toBe(true);
      }
    }
  });

  it('borne à la chambre tout rapprochement d’identité par slug', () => {
    // `{ slug: p.slug }` seul dans un OR assimilait « même slug » à « même
    // personne ». Un nouvel élu homonyme d'une personne de l'autre chambre était
    // résolu sur SA ligne, qui était ensuite écrasée : l'URL survivait en
    // pointant vers quelqu'un d'autre.
    const resolutions = appels('parlementaire', 'findFirst');
    expect(resolutions.length, 'aucune résolution d’identité trouvée').toBeGreaterThan(0);

    for (const appel of resolutions) {
      const branchesNues = appel.match(/^\s*\{\s*slug:\s*\w+\.slug\s*\},?\s*$/gm) ?? [];
      expect(
        branchesNues,
        'Branche `{ slug: x.slug }` non bornée dans un OR de résolution : elle ' +
          'autorise le rapprochement inter-chambres, donc l’écrasement d’une ' +
          'personne par son homonyme.',
      ).toEqual([]);
      expect(
        /chambre:[\s\S]{0,80}slug:|slug:[\s\S]{0,80}chambre:/.test(appel),
        'Le rapprochement par slug doit être apparié à une contrainte de chambre.',
      ).toBe(true);
    }
  });

  it('écarte le slug par destructuration explicite sur les deux chemins concernés', () => {
    // Ces deux payloads servent aussi à la création, où le slug est requis : il
    // ne peut pas être simplement retiré de l'objet, seulement écarté ici.
    expect(src).toContain('const { slug: _slug, ...sansSlug } = data;');
    expect(src).toContain('const { slug: _slug, ...donneesSansSlug } = data;');
  });
});
