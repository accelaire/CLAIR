/**
 * Script pour peupler les logos et l'ordre des groupes politiques dans l'hémicycle
 *
 * Usage: pnpm exec tsx scripts/seed-group-logos.ts (depuis la racine du projet)
 *
 * Ce script initialise :
 * - Les URLs des logos officiels (Wikipedia Commons)
 * - L'ordre des groupes dans l'hémicycle (gauche → droite)
 * - La position politique de chaque groupe
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configuration complète des groupes politiques
// Ordre dans l'hémicycle : gauche → droite (basé sur les sources officielles)
// Sources:
// - AN: https://www.touteleurope.eu/vie-politique-des-etats-membres/elections-legislatives-2024-quelle-repartition-des-sieges-dans-la-future-assemblee-nationale/
// - Sénat: https://www.senat.fr/vos-senateurs/groupes-politiques.html

interface GroupConfig {
  logoUrl: string;
  ordre: number;
  position: string;
}

// === ASSEMBLÉE NATIONALE ===
// Ordre dans l'hémicycle de gauche à droite
const ASSEMBLEE_GROUPS: Record<string, GroupConfig> = {
  // 1. Gauche démocrate et républicaine (PCF) - Extrême gauche
  'gdr': {
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/9d/Logo_%E2%80%93_Parti_communiste_fran%C3%A7ais_%282018%29.svg',
    ordre: 1,
    position: 'extreme_gauche',
  },
  // 2. La France Insoumise - Nouveau Front Populaire
  'lfi-nfp': {
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/Logo_France_Insoumise.svg',
    ordre: 2,
    position: 'gauche',
  },
  // 3. Écologiste et Social
  'ecos': {
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Ecologiste_2024.png',
    ordre: 3,
    position: 'gauche',
  },
  // 4. Socialistes et apparentés
  'soc': {
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Logo_du_Parti_socialiste.png',
    ordre: 4,
    position: 'centre_gauche',
  },
  // 5. LIOT - Libertés, Indépendants, Outre-mer et Territoires
  'liot': {
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/49/LIOT_Group.png',
    ordre: 5,
    position: 'centre',
  },
  // 6. Ensemble pour la République (Renaissance)
  'epr': {
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/75/Groupe_EPR.png',
    ordre: 6,
    position: 'centre',
  },
  // 7. Les Démocrates (MoDem)
  'dem': {
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/96/MoDem_logo_2019.svg',
    ordre: 7,
    position: 'centre',
  },
  // 8. Horizons & Indépendants
  'hor': {
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Horizons_Group.png',
    ordre: 8,
    position: 'centre_droit',
  },
  // 9. Droite Républicaine (Les Républicains)
  'dr': {
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/00/Les_R%C3%A9publicains_-_logo_%28France%2C_2023%29.svg',
    ordre: 9,
    position: 'droite',
  },
  // 10. UDR - Union des droites pour la République
  'uddplr': {
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/UDR_logo.svg',
    ordre: 10,
    position: 'droite',
  },
  // 11. Rassemblement National - Extrême droite
  'rn': {
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Logo_Rassemblement_National.svg',
    ordre: 11,
    position: 'extreme_droite',
  },
  // 99. Non-Inscrits (toujours en dernier)
  'ni': {
    logoUrl: '',
    ordre: 99,
    position: 'centre',
  },
};

// === SÉNAT ===
// Ordre dans l'hémicycle de gauche à droite
const SENAT_GROUPS: Record<string, GroupConfig> = {
  // 1. Groupe CRCE-K (Communiste Républicain Citoyen et Écologiste - Kanaky)
  'crc': {
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/9d/Logo_%E2%80%93_Parti_communiste_fran%C3%A7ais_%282018%29.svg',
    ordre: 1,
    position: 'gauche',
  },
  // 2. Groupe Écologiste - Solidarité et Territoires
  'gest': {
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Ecologiste_2024.png',
    ordre: 2,
    position: 'gauche',
  },
  // 3. Groupe Socialiste, Écologiste et Républicain
  'soc': {
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Logo_du_Parti_socialiste.png',
    ordre: 3,
    position: 'centre_gauche',
  },
  // 4. RDSE - Rassemblement Démocratique et Social Européen
  'rdse': {
    logoUrl: 'https://upload.wikimedia.org/wikipedia/fr/c/c4/RDSE.png',
    ordre: 4,
    position: 'centre',
  },
  // 5. RDPI - Rassemblement des démocrates, progressistes et indépendants
  'lrem': {
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/75/Groupe_EPR.png',
    ordre: 5,
    position: 'centre',
  },
  // 6. Union Centriste
  'uc': {
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/96/MoDem_logo_2019.svg',
    ordre: 6,
    position: 'centre',
  },
  // 7. LIRT - Les Indépendants – République et Territoires
  'rtli': {
    logoUrl: 'https://upload.wikimedia.org/wikipedia/fr/a/a3/Logo_Groupe_Les_Ind%C3%A9pendants_R%C3%A9publique_et_territoires.jpg',
    ordre: 7,
    position: 'centre_droit',
  },
  // 8. Groupe Les Républicains
  'ump': {
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/00/Les_R%C3%A9publicains_-_logo_%28France%2C_2023%29.svg',
    ordre: 8,
    position: 'droite',
  },
  // 99. Non-Inscrits (toujours en dernier)
  'ni': {
    logoUrl: '',
    ordre: 99,
    position: 'centre',
  },
};

async function seedGroupLogosAndOrder() {
  console.log('🎨 Mise à jour des logos et de l\'ordre des groupes politiques...\n');

  const groupes = await prisma.groupePolitique.findMany({
    where: { actif: true },
    select: { id: true, slug: true, nom: true, chambre: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const groupe of groupes) {
    const slugLower = groupe.slug.toLowerCase();
    const config = groupe.chambre === 'assemblee'
      ? ASSEMBLEE_GROUPS[slugLower]
      : SENAT_GROUPS[slugLower];

    if (config) {
      await prisma.groupePolitique.update({
        where: { id: groupe.id },
        data: {
          logoUrl: config.logoUrl || null,
          ordre: config.ordre,
          position: config.position,
        },
      });
      console.log(`✅ ${groupe.nom} (${groupe.chambre}) -> ordre=${config.ordre}, position=${config.position}`);
      updated++;
    } else {
      console.log(`⚠️  ${groupe.nom} (${groupe.chambre}) -> Pas de configuration`);
      skipped++;
    }
  }

  console.log(`\n📊 Résumé: ${updated} groupes mis à jour, ${skipped} groupes sans configuration`);

  // Afficher l'ordre final
  console.log('\n📋 Ordre des groupes dans l\'hémicycle:\n');

  const assemblee = await prisma.groupePolitique.findMany({
    where: { chambre: 'assemblee', actif: true },
    orderBy: { ordre: 'asc' },
    select: { nom: true, ordre: true, position: true },
  });
  console.log('=== ASSEMBLÉE NATIONALE ===');
  assemblee.forEach(g => console.log(`  ${g.ordre}. ${g.nom} (${g.position})`));

  const senat = await prisma.groupePolitique.findMany({
    where: { chambre: 'senat', actif: true },
    orderBy: { ordre: 'asc' },
    select: { nom: true, ordre: true, position: true },
  });
  console.log('\n=== SÉNAT ===');
  senat.forEach(g => console.log(`  ${g.ordre}. ${g.nom} (${g.position})`));
}

seedGroupLogosAndOrder()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
