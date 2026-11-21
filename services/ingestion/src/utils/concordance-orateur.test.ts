import { describe, expect, it } from 'vitest';
import { concordanceOrateur, ficheDansLaSeance, ficheRetenue, type Concordance } from './concordance-orateur';

// Cas relevés en prod le 21/11/2026 : (prénom, nom) au compte rendu, puis la fiche
// que l'identifiant d'acteur désignait.
const cas: Array<[string | null, string, string, string, Concordance]> = [
  // Identifiant faux : une autre personne parle
  ['Alice', 'Rufo', 'François', 'Ruffin', 'autre_personne'],
  ['Alain', 'Griset', 'Victor', 'Habert-Dassault', 'autre_personne'],
  ['Prisca', 'Kergoat', 'Antoine', 'Armand', 'autre_personne'],
  ['Sébastien', 'Chenu', 'Yaël', 'Braun-Pivet', 'autre_personne'],
  // Homonymes : même nom, autre prénom
  ['Maud', 'Petit', 'Frédéric', 'Petit', 'autre_personne'],
  ['Philippe', 'Brun', 'Fabrice', 'Brun', 'autre_personne'],
  ['Christophe', 'Doré,', 'Paul', 'Christophe', 'autre_personne'],
  // Anonymes et collectifs
  ['Un', 'député du groupe LR', 'Richard', 'Ferrand', 'collectif'],
  ['Plusieurs', 'députés des groupes LFI-NUPES, Écolo-NUPES et GDR-NUPES', 'Stéphane', 'Peu', 'collectif'],
  ['Une', 'députée du groupe LaREM', 'Laetitia', 'Saint-Paul', 'collectif'],
  // Même personne, écrite autrement
  ['Loïc', 'Prud’homme', 'Loïc', "Prud'homme", 'meme_personne'],
  ['Michel', 'Castellani (LIOT)', 'Michel', 'Castellani', 'meme_personne'],
  ['Carlos Martens', 'Bilongo', 'Carlos', 'Martens Bilongo', 'meme_personne'],
  ['Benjamin', 'Lucas', 'Benjamin', 'Lucas-Lundy', 'meme_personne'],
  ['Emmanuel', 'Taché de la Pagerie', 'Emmanuel', 'Taché', 'meme_personne'],
  ['Delphine', 'O', 'Delphine', 'O', 'meme_personne'],
  ['Pierre', 'Morel-À-L’Huissier', 'Pierre', "Morel-À-L'Huissier", 'meme_personne'],
  [null, 'Dupont', 'Jeanne', 'Dupont', 'meme_personne'],
  // Déclaration commune : la fiche est l'un des deux
  ['Bruno', 'Studer et Philippe Vigier', 'Philippe', 'Vigier', 'meme_personne'],
  // Nom d'usage changé (Christine Cloarec-Le Nabour)
  ['Christine', 'Cloarec', 'Christine', 'Le Nabour', 'meme_prenom'],
  // Fonction sans nom
  ['le', 'rapporteur général', 'Philippe', 'Juvin', 'fonction'],
  ['la', 'rapporteure', 'Estelle', 'Youssouffa', 'fonction'],
  ['la', 'ministre', 'Amélie', 'de Montchalin', 'fonction'],
  ['le', 'président', 'Sylvain', 'Waserman', 'fonction'],
];

describe('concordanceOrateur', () => {
  it.each(cas)('%s %s → %s %s : %s', (prenom, nom, fichePrenom, ficheNom, attendu) => {
    expect(concordanceOrateur({ prenom, nom }, { prenom: fichePrenom, nom: ficheNom })).toBe(attendu);
  });
});

describe('ficheRetenue', () => {
  it("écarte une autre personne et les collectifs, garde le reste", () => {
    expect(ficheRetenue('autre_personne')).toBe(false);
    expect(ficheRetenue('collectif')).toBe(false);
    expect(ficheRetenue('meme_personne')).toBe(true);
    expect(ficheRetenue('meme_prenom')).toBe(true);
    expect(ficheRetenue('fonction')).toBe(true);
  });
});

describe('ficheDansLaSeance', () => {
  const clouet = { prenom: 'Hadrien', nom: 'Clouet' };
  const autre = (orateur: { prenom: string | null; nom: string }, parlementaireId: string, fiche = orateur) => ({
    orateur,
    parlementaireId,
    fiche,
  });

  it("rend la fiche que le même orateur porte ailleurs dans la séance", () => {
    expect(ficheDansLaSeance(clouet, [autre(clouet, 'fiche-clouet')])).toBe('fiche-clouet');
  });

  it('ne rend rien si le même orateur porte deux fiches différentes', () => {
    expect(ficheDansLaSeance(clouet, [autre(clouet, 'a'), autre(clouet, 'b')])).toBeNull();
  });

  it("ne rend rien si l'orateur n'est pas écrit à l'identique", () => {
    expect(ficheDansLaSeance(clouet, [autre({ prenom: null, nom: 'Clouet' }, 'fiche-clouet')])).toBeNull();
  });

  it('ne rend pas une fiche que le nom contredit, ni une simple concordance de prénom', () => {
    // L'autre paragraphe porte lui aussi un identifiant faux.
    expect(ficheDansLaSeance(clouet, [autre(clouet, 'fiche-trouve', { prenom: 'Aurélie', nom: 'Trouvé' })])).toBeNull();
    const cloarec = { prenom: 'Christine', nom: 'Cloarec' };
    expect(ficheDansLaSeance(cloarec, [autre(cloarec, 'x', { prenom: 'Christine', nom: 'Le Nabour' })])).toBeNull();
  });

  it("ne rend rien à un collectif ou à une fonction", () => {
    const collectif = { prenom: 'Un', nom: 'député du groupe LR' };
    expect(ficheDansLaSeance(collectif, [autre(collectif, 'x', { prenom: 'Richard', nom: 'Ferrand' })])).toBeNull();
  });
});
