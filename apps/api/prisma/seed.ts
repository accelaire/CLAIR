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
      where: { slug: 'rn' },
      update: {},
      create: {
        slug: 'rn',
        nom: 'RN',
        nomComplet: 'Rassemblement National',
        couleur: '#0D47A1',
        position: 'extreme_droite',
        ordre: 1,
      },
    }),
    prisma.groupePolitique.upsert({
      where: { slug: 'lr' },
      update: {},
      create: {
        slug: 'lr',
        nom: 'LR',
        nomComplet: 'Les Républicains',
        couleur: '#1565C0',
        position: 'droite',
        ordre: 2,
      },
    }),
    prisma.groupePolitique.upsert({
      where: { slug: 'ens' },
      update: {},
      create: {
        slug: 'ens',
        nom: 'ENS',
        nomComplet: 'Ensemble pour la République',
        couleur: '#FFB300',
        position: 'centre',
        ordre: 3,
      },
    }),
    prisma.groupePolitique.upsert({
      where: { slug: 'modem' },
      update: {},
      create: {
        slug: 'modem',
        nom: 'MoDem',
        nomComplet: 'Mouvement Démocrate',
        couleur: '#FF9800',
        position: 'centre',
        ordre: 4,
      },
    }),
    prisma.groupePolitique.upsert({
      where: { slug: 'hor' },
      update: {},
      create: {
        slug: 'hor',
        nom: 'HOR',
        nomComplet: 'Horizons',
        couleur: '#42A5F5',
        position: 'centre_droit',
        ordre: 5,
      },
    }),
    prisma.groupePolitique.upsert({
      where: { slug: 'soc' },
      update: {},
      create: {
        slug: 'soc',
        nom: 'SOC',
        nomComplet: 'Socialistes et apparentés',
        couleur: '#F06292',
        position: 'gauche',
        ordre: 6,
      },
    }),
    prisma.groupePolitique.upsert({
      where: { slug: 'lfi' },
      update: {},
      create: {
        slug: 'lfi',
        nom: 'LFI',
        nomComplet: 'La France Insoumise',
        couleur: '#E53935',
        position: 'gauche',
        ordre: 7,
      },
    }),
    prisma.groupePolitique.upsert({
      where: { slug: 'eco' },
      update: {},
      create: {
        slug: 'eco',
        nom: 'ECO',
        nomComplet: 'Écologistes',
        couleur: '#4CAF50',
        position: 'gauche',
        ordre: 8,
      },
    }),
    prisma.groupePolitique.upsert({
      where: { slug: 'gdr' },
      update: {},
      create: {
        slug: 'gdr',
        nom: 'GDR',
        nomComplet: 'Gauche Démocrate et Républicaine',
        couleur: '#B71C1C',
        position: 'gauche',
        ordre: 9,
      },
    }),
    prisma.groupePolitique.upsert({
      where: { slug: 'liot' },
      update: {},
      create: {
        slug: 'liot',
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
      where: { departement_numero: { departement: '75', numero: 1 } },
      update: {},
      create: { departement: '75', numero: 1, nom: 'Paris (1ère)', population: 120000 },
    }),
    prisma.circonscription.upsert({
      where: { departement_numero: { departement: '75', numero: 2 } },
      update: {},
      create: { departement: '75', numero: 2, nom: 'Paris (2ème)', population: 115000 },
    }),
    prisma.circonscription.upsert({
      where: { departement_numero: { departement: '13', numero: 1 } },
      update: {},
      create: { departement: '13', numero: 1, nom: 'Bouches-du-Rhône (1ère)', population: 130000 },
    }),
    prisma.circonscription.upsert({
      where: { departement_numero: { departement: '69', numero: 1 } },
      update: {},
      create: { departement: '69', numero: 1, nom: 'Rhône (1ère)', population: 125000 },
    }),
    prisma.circonscription.upsert({
      where: { departement_numero: { departement: '31', numero: 1 } },
      update: {},
      create: { departement: '31', numero: 1, nom: 'Haute-Garonne (1ère)', population: 140000 },
    }),
  ]);

  console.log(`✅ Created ${circos.length} circonscriptions`);

  // ===========================================================================
  // Députés (exemples)
  // ===========================================================================
  console.log('Creating sample députés...');

  const deputes = await Promise.all([
    prisma.depute.upsert({
      where: { slug: 'marine-le-pen' },
      update: {},
      create: {
        slug: 'marine-le-pen',
        nom: 'Le Pen',
        prenom: 'Marine',
        sexe: 'F',
        dateNaissance: new Date('1968-08-05'),
        profession: 'Avocate',
        photoUrl: 'https://www.assemblee-nationale.fr/dyn/deputes/PA267013_official.jpg',
        twitter: 'MLP_officiel',
        groupe: { connect: { slug: 'rn' } },
      },
    }),
    prisma.depute.upsert({
      where: { slug: 'gabriel-attal' },
      update: {},
      create: {
        slug: 'gabriel-attal',
        nom: 'Attal',
        prenom: 'Gabriel',
        sexe: 'M',
        dateNaissance: new Date('1989-03-16'),
        profession: 'Haut fonctionnaire',
        photoUrl: 'https://www.assemblee-nationale.fr/dyn/deputes/PA721844_official.jpg',
        twitter: 'GabrielAttal',
        groupe: { connect: { slug: 'ens' } },
      },
    }),
    prisma.depute.upsert({
      where: { slug: 'jean-luc-melenchon' },
      update: {},
      create: {
        slug: 'jean-luc-melenchon',
        nom: 'Mélenchon',
        prenom: 'Jean-Luc',
        sexe: 'M',
        dateNaissance: new Date('1951-08-19'),
        profession: 'Professeur',
        photoUrl: 'https://www.assemblee-nationale.fr/dyn/deputes/PA2397_official.jpg',
        twitter: 'JLMelenchon',
        groupe: { connect: { slug: 'lfi' } },
      },
    }),
    prisma.depute.upsert({
      where: { slug: 'olivier-faure' },
      update: {},
      create: {
        slug: 'olivier-faure',
        nom: 'Faure',
        prenom: 'Olivier',
        sexe: 'M',
        dateNaissance: new Date('1968-06-06'),
        profession: 'Cadre du secteur public',
        photoUrl: 'https://www.assemblee-nationale.fr/dyn/deputes/PA720752_official.jpg',
        twitter: 'faborel',
        groupe: { connect: { slug: 'soc' } },
      },
    }),
    prisma.depute.upsert({
      where: { slug: 'laurent-wauquiez' },
      update: {},
      create: {
        slug: 'laurent-wauquiez',
        nom: 'Wauquiez',
        prenom: 'Laurent',
        sexe: 'M',
        dateNaissance: new Date('1975-04-12'),
        profession: 'Haut fonctionnaire',
        photoUrl: 'https://www.assemblee-nationale.fr/dyn/deputes/PA721950_official.jpg',
        groupe: { connect: { slug: 'lr' } },
      },
    }),
  ]);

  console.log(`✅ Created ${deputes.length} sample députés`);

  // ===========================================================================
  // Scrutins (exemples)
  // ===========================================================================
  console.log('Creating sample scrutins...');

  const scrutins = await Promise.all([
    prisma.scrutin.upsert({
      where: { numero: 4001 },
      update: {},
      create: {
        numero: 4001,
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
      where: { numero: 4000 },
      update: {},
      create: {
        numero: 4000,
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
      where: { numero: 3999 },
      update: {},
      create: {
        numero: 3999,
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
