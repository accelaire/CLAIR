// =============================================================================
// Seed de la base de données avec des données de test
// Usage: pnpm db:seed
// =============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ===========================================================================
  // Groupes politiques
  // ===========================================================================
  console.log('Creating political groups...');

  const groupes = await Promise.all([
    prisma.groupePolitique.upsert({
      where: { slug_chambre: { slug: 'rn', chambre: 'assemblee' } },
      update: {},
      create: {
        slug: 'rn',
        chambre: 'assemblee',
        nom: 'RN',
        nomComplet: 'Rassemblement National',
        couleur: '#0D47A1',
        position: 'extreme_droite',
        ordre: 1,
      },
    }),
    prisma.groupePolitique.upsert({
      where: { slug_chambre: { slug: 'lr', chambre: 'assemblee' } },
      update: {},
      create: {
        slug: 'lr',
        chambre: 'assemblee',
        nom: 'LR',
        nomComplet: 'Les Républicains',
        couleur: '#1565C0',
        position: 'droite',
        ordre: 2,
      },
    }),
    prisma.groupePolitique.upsert({
      where: { slug_chambre: { slug: 'ens', chambre: 'assemblee' } },
      update: {},
      create: {
        slug: 'ens',
        chambre: 'assemblee',
        nom: 'ENS',
        nomComplet: 'Ensemble pour la République',
        couleur: '#FFB300',
        position: 'centre',
        ordre: 3,
      },
    }),
    prisma.groupePolitique.upsert({
      where: { slug_chambre: { slug: 'modem', chambre: 'assemblee' } },
      update: {},
      create: {
        slug: 'modem',
        chambre: 'assemblee',
        nom: 'MoDem',
        nomComplet: 'Mouvement Démocrate',
        couleur: '#FF9800',
        position: 'centre',
        ordre: 4,
      },
    }),
    prisma.groupePolitique.upsert({
      where: { slug_chambre: { slug: 'hor', chambre: 'assemblee' } },
      update: {},
      create: {
        slug: 'hor',
        chambre: 'assemblee',
        nom: 'HOR',
        nomComplet: 'Horizons',
        couleur: '#42A5F5',
        position: 'centre_droit',
        ordre: 5,
      },
    }),
    prisma.groupePolitique.upsert({
      where: { slug_chambre: { slug: 'soc', chambre: 'assemblee' } },
      update: {},
      create: {
        slug: 'soc',
        chambre: 'assemblee',
        nom: 'SOC',
        nomComplet: 'Socialistes et apparentés',
        couleur: '#F06292',
        position: 'gauche',
        ordre: 6,
      },
    }),
    prisma.groupePolitique.upsert({
      where: { slug_chambre: { slug: 'lfi', chambre: 'assemblee' } },
      update: {},
      create: {
        slug: 'lfi',
        chambre: 'assemblee',
        nom: 'LFI',
        nomComplet: 'La France Insoumise',
        couleur: '#E53935',
        position: 'gauche',
        ordre: 7,
      },
    }),
    prisma.groupePolitique.upsert({
      where: { slug_chambre: { slug: 'eco', chambre: 'assemblee' } },
      update: {},
      create: {
        slug: 'eco',
        chambre: 'assemblee',
        nom: 'ECO',
        nomComplet: 'Écologistes',
        couleur: '#4CAF50',
        position: 'gauche',
        ordre: 8,
      },
    }),
    prisma.groupePolitique.upsert({
      where: { slug_chambre: { slug: 'gdr', chambre: 'assemblee' } },
      update: {},
      create: {
        slug: 'gdr',
        chambre: 'assemblee',
        nom: 'GDR',
        nomComplet: 'Gauche Démocrate et Républicaine',
        couleur: '#B71C1C',
        position: 'gauche',
        ordre: 9,
      },
    }),
    prisma.groupePolitique.upsert({
      where: { slug_chambre: { slug: 'liot', chambre: 'assemblee' } },
      update: {},
      create: {
        slug: 'liot',
        chambre: 'assemblee',
        nom: 'LIOT',
        nomComplet: 'Libertés, Indépendants, Outre-mer et Territoires',
        couleur: '#9E9E9E',
        position: 'centre',
        ordre: 10,
      },
    }),
  ]);

  console.log(`✅ Created ${groupes.length} political groups`);

  // ===========================================================================
  // Circonscriptions (exemples)
  // ===========================================================================
  console.log('Creating sample circonscriptions...');

  const circos = await Promise.all([
    prisma.circonscription.upsert({
      where: { departement_numero_type: { departement: '75', numero: 1, type: 'legislative' } },
      update: {},
      create: { departement: '75', numero: 1, type: 'legislative', nom: 'Paris (1ère)', population: 120000 },
    }),
    prisma.circonscription.upsert({
      where: { departement_numero_type: { departement: '75', numero: 2, type: 'legislative' } },
      update: {},
      create: { departement: '75', numero: 2, type: 'legislative', nom: 'Paris (2ème)', population: 115000 },
    }),
    prisma.circonscription.upsert({
      where: { departement_numero_type: { departement: '13', numero: 1, type: 'legislative' } },
      update: {},
      create: { departement: '13', numero: 1, type: 'legislative', nom: 'Bouches-du-Rhône (1ère)', population: 130000 },
    }),
    prisma.circonscription.upsert({
      where: { departement_numero_type: { departement: '69', numero: 1, type: 'legislative' } },
      update: {},
      create: { departement: '69', numero: 1, type: 'legislative', nom: 'Rhône (1ère)', population: 125000 },
    }),
    prisma.circonscription.upsert({
      where: { departement_numero_type: { departement: '31', numero: 1, type: 'legislative' } },
      update: {},
      create: { departement: '31', numero: 1, type: 'legislative', nom: 'Haute-Garonne (1ère)', population: 140000 },
    }),
  ]);

  console.log(`✅ Created ${circos.length} circonscriptions`);

  // ===========================================================================
  // Parlementaires (exemples)
  // ===========================================================================
  console.log('Creating sample parlementaires...');

  const parlementaires = await Promise.all([
    prisma.parlementaire.upsert({
      where: { slug: 'marine-le-pen' },
      update: {},
      create: {
        slug: 'marine-le-pen',
        chambre: 'assemblee',
        nom: 'Le Pen',
        prenom: 'Marine',
        sexe: 'F',
        dateNaissance: new Date('1968-08-05'),
        profession: 'Avocate',
        photoUrl: 'https://www.assemblee-nationale.fr/dyn/deputes/PA267013_official.jpg',
        twitter: 'MLP_officiel',
        groupe: { connect: { slug_chambre: { slug: 'rn', chambre: 'assemblee' } } },
      },
    }),
    prisma.parlementaire.upsert({
      where: { slug: 'gabriel-attal' },
      update: {},
      create: {
        slug: 'gabriel-attal',
        chambre: 'assemblee',
        nom: 'Attal',
        prenom: 'Gabriel',
        sexe: 'M',
        dateNaissance: new Date('1989-03-16'),
        profession: 'Haut fonctionnaire',
        photoUrl: 'https://www.assemblee-nationale.fr/dyn/deputes/PA721844_official.jpg',
        twitter: 'GabrielAttal',
        groupe: { connect: { slug_chambre: { slug: 'ens', chambre: 'assemblee' } } },
      },
    }),
    prisma.parlementaire.upsert({
      where: { slug: 'jean-luc-melenchon' },
      update: {},
      create: {
        slug: 'jean-luc-melenchon',
        chambre: 'assemblee',
        nom: 'Mélenchon',
        prenom: 'Jean-Luc',
        sexe: 'M',
        dateNaissance: new Date('1951-08-19'),
        profession: 'Professeur',
        photoUrl: 'https://www.assemblee-nationale.fr/dyn/deputes/PA2397_official.jpg',
        twitter: 'JLMelenchon',
        groupe: { connect: { slug_chambre: { slug: 'lfi', chambre: 'assemblee' } } },
      },
    }),
    prisma.parlementaire.upsert({
      where: { slug: 'olivier-faure' },
      update: {},
      create: {
        slug: 'olivier-faure',
        chambre: 'assemblee',
        nom: 'Faure',
        prenom: 'Olivier',
        sexe: 'M',
        dateNaissance: new Date('1968-06-06'),
        profession: 'Cadre du secteur public',
        photoUrl: 'https://www.assemblee-nationale.fr/dyn/deputes/PA720752_official.jpg',
        twitter: 'faborel',
        groupe: { connect: { slug_chambre: { slug: 'soc', chambre: 'assemblee' } } },
      },
    }),
    prisma.parlementaire.upsert({
      where: { slug: 'laurent-wauquiez' },
      update: {},
      create: {
        slug: 'laurent-wauquiez',
        chambre: 'assemblee',
        nom: 'Wauquiez',
        prenom: 'Laurent',
        sexe: 'M',
        dateNaissance: new Date('1975-04-12'),
        profession: 'Haut fonctionnaire',
        photoUrl: 'https://www.assemblee-nationale.fr/dyn/deputes/PA721950_official.jpg',
        groupe: { connect: { slug_chambre: { slug: 'lr', chambre: 'assemblee' } } },
      },
    }),
  ]);

  console.log(`✅ Created ${parlementaires.length} sample parlementaires`);

  // ===========================================================================
  // Scrutins (exemples)
  // ===========================================================================
  console.log('Creating sample scrutins...');

  const scrutins = await Promise.all([
    prisma.scrutin.upsert({
      where: { numero_chambre: { numero: 4001, chambre: 'assemblee' } },
      update: {},
      create: {
        numero: 4001,
        chambre: 'assemblee',
        date: new Date('2025-12-09'),
        titre: 'Projet de loi de financement de la sécurité sociale pour 2026',
        typeVote: 'solennel',
        sort: 'adopte',
        nombreVotants: 456,
        nombrePour: 241,
        nombreContre: 180,
        nombreAbstention: 35,
        tags: ['budget', 'sante'],
        importance: 5,
      },
    }),
    prisma.scrutin.upsert({
      where: { numero_chambre: { numero: 4000, chambre: 'assemblee' } },
      update: {},
      create: {
        numero: 4000,
        chambre: 'assemblee',
        date: new Date('2025-12-01'),
        titre: 'Motion de censure déposée par le groupe LFI',
        typeVote: 'motion',
        sort: 'rejete',
        nombreVotants: 560,
        nombrePour: 187,
        nombreContre: 289,
        nombreAbstention: 84,
        tags: ['gouvernement'],
        importance: 5,
      },
    }),
    prisma.scrutin.upsert({
      where: { numero_chambre: { numero: 3999, chambre: 'assemblee' } },
      update: {},
      create: {
        numero: 3999,
        chambre: 'assemblee',
        date: new Date('2025-11-28'),
        titre: 'Proposition de loi sur la transition énergétique',
        typeVote: 'ordinaire',
        sort: 'adopte',
        nombreVotants: 412,
        nombrePour: 298,
        nombreContre: 89,
        nombreAbstention: 25,
        tags: ['environnement'],
        importance: 3,
      },
    }),
  ]);

  console.log(`✅ Created ${scrutins.length} sample scrutins`);

  // ===========================================================================
  // Lobbyistes (exemples)
  // ===========================================================================
  console.log('Creating sample lobbyistes...');

  const lobbyistes = await Promise.all([
    prisma.lobbyiste.upsert({
      where: { siren: '123456789' },
      update: {},
      create: {
        siren: '123456789',
        nom: 'TotalEnergies',
        type: 'entreprise',
        secteur: 'Énergie',
        budgetAnnuel: 5000000,
        nbLobbyistes: 15,
        siteWeb: 'https://totalenergies.fr',
      },
    }),
    prisma.lobbyiste.upsert({
      where: { siren: '987654321' },
      update: {},
      create: {
        siren: '987654321',
        nom: 'Greenpeace France',
        type: 'association',
        secteur: 'Environnement',
        budgetAnnuel: 800000,
        nbLobbyistes: 5,
        siteWeb: 'https://greenpeace.fr',
      },
    }),
    prisma.lobbyiste.upsert({
      where: { siren: '456789123' },
      update: {},
      create: {
        siren: '456789123',
        nom: 'MEDEF',
        type: 'organisation_pro',
        secteur: 'Patronat',
        budgetAnnuel: 3000000,
        nbLobbyistes: 20,
        siteWeb: 'https://medef.com',
      },
    }),
  ]);

  console.log(`✅ Created ${lobbyistes.length} sample lobbyistes`);

  console.log('\n✨ Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
