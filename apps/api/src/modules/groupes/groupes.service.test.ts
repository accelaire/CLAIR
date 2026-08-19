import { describe, it, expect } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { GroupesService } from './groupes.service';

/**
 * Le filtre « scrutins initiés par le groupe » se construit en SQL brut : il n'y
 * a pas de valeur de retour à comparer, seulement un fragment de requête. Ces
 * tests portent donc sur le fragment lui-même.
 *
 * Ce n'est pas un détail d'implémentation qu'on fige par confort. La règle qu'il
 * encode — un code de groupe ne se cherche qu'en début de mot — est ce qui
 * sépare « les scrutins demandés par Renaissance » de « les scrutins dont le
 * texte du demandeur contient les lettres r et e ». Écrite en sous-chaîne, elle
 * attribuait 2 212 scrutins d'autres groupes à Renaissance et 1 054 aux
 * non-inscrits. Une réécriture qui repasserait en `ILIKE '%' || gd.nom || '%'`
 * doit casser ici.
 */
function fragment(): string {
  const service = new GroupesService({} as PrismaClient, {} as Redis);
  // La méthode est privée : elle n'a pas d'appelant hors de la classe, et c'est
  // très bien ainsi. On y accède pour ce seul test.
  return (service as unknown as {
    demandeurInitieParSql: (id: string) => { sql: string };
  }).demandeurInitieParSql('groupe-test').sql;
}

describe('demandeurInitieParSql', () => {
  it('ancre les codes de groupe au début d’un mot', () => {
    // `\m` est l'ancre de début de mot de Postgres. Sans elle, « RE » se trouve
    // dans « Présidente » et « apparentés ».
    expect(fragment()).toContain("'\\m' || gd.nom");
    expect(fragment()).toContain("'\\m' || gd.nom_court");
  });

  it('ne cherche jamais un code de groupe en sous-chaîne', () => {
    const sql = fragment();
    expect(sql).not.toContain("'%' || gd.nom || '%'");
    expect(sql).not.toContain("'%' || gd.nom_court || '%'");
  });

  it('écarte les codes de moins de trois caractères', () => {
    // « NI » et « UC » ne portent pas assez d'information pour se distinguer
    // d'un prénom, même ancrés : « Nicole », « Jean-Luc ».
    const sql = fragment();
    expect(sql).toContain('length(gd.nom) >= 3');
    expect(sql).toContain('length(gd.nom_court) >= 3');
  });

  it('garde le libellé long en sous-chaîne', () => {
    // Il est assez discriminant pour ça, et c'est lui qui fait tout le travail à
    // l'Assemblée, dont les demandeurs citent le nom du groupe entre guillemets.
    expect(fragment()).toContain("'%' || gd.nom_complet || '%'");
  });

  it('n’injecte dans le motif que des libellés sans métacaractère', () => {
    const sql = fragment();
    expect(sql).toContain("gd.nom ~ '^[[:alnum:] _-]+$'");
    expect(sql).toContain("gd.nom_court ~ '^[[:alnum:] _-]+$'");
  });
});

/**
 * La règle vaut par ce qu'elle produit sur les vrais libellés de demandeur, pas
 * par la forme du SQL. Ces cas rejouent en JavaScript la sémantique de `~*` avec
 * ancre de mot, sur des textes relevés en base.
 */
describe('sémantique de l’ancre de début de mot', () => {
  const initiePar = (code: string, demandeur: string) =>
    code.length >= 3 && new RegExp(`\\b${code}`, 'i').test(demandeur);

  it('retrouve les cas légitimes', () => {
    expect(initiePar('SOC', 'Mme Monique Lubin et les membres du groupe Socialiste')).toBe(true);
    expect(initiePar('SOC', 'Président du groupe "Socialistes et apparentés"')).toBe(true);
  });

  it('ne franchit pas les accents — d’où le repli sur le libellé long', () => {
    // `~*` ignore la casse, pas les accents : le code ECOLO ne retrouve pas
    // « Écologiste ». Ces groupes se rattachent par leur libellé long, et c'est
    // aussi pourquoi celui-ci reste cherché en sous-chaîne.
    expect(initiePar('ECOLO', 'Présidente du groupe "Écologiste"')).toBe(false);
  });

  it('ne prend plus les coïncidences en milieu de mot', () => {
    // Les trois cas mesurés en base, chacun attribuant des scrutins à un groupe
    // qui ne les a jamais demandés.
    expect(initiePar('RE', 'Présidente du groupe "La France insoumise"')).toBe(false);
    expect(initiePar('NI', 'Mme Éliane Assassi et les membres du groupe communiste')).toBe(false);
    expect(initiePar('UC', 'M. Jean-Luc Fichet et les membres du groupe Socialiste')).toBe(false);
  });
});
