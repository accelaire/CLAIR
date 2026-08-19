/**
 * Backfill ciblé des identités de sénateurs, depuis ODSEN_GENERAL.
 *
 * N'écrit que deux colonnes, et seulement quand elles sont manifestement à
 * réparer : `date_naissance` si elle est absente, `profession` si la seule
 * différence avec la source est l'accentuation. Aucun mandat n'est touché —
 * c'est le rôle du worker `sync-senateurs-histo`, dont on ne veut pas ici la
 * portée complète pour une correction d'état civil.
 *
 * Pourquoi un script séparé du worker `sync-senateurs-histo`, qui sait déjà
 * faire ces deux corrections : ce worker importe aussi des mandats historiques
 * et en met à jour un millier à chaque passage. Pour une réparation d'état
 * civil sur une base de production, on préfère un outil dont on peut énoncer
 * exactement ce qu'il touche — deux colonnes, jamais un mandat.
 *
 * À lancer depuis `services/ingestion` (le client Prisma s'y résout) :
 *   DATABASE_URL=… node scripts/backfill-identites-senateurs.mjs [--apply]
 * Sans --apply, se contente de compter ce qui serait écrit.
 */
import { PrismaClient } from '@prisma/client';

const APPLIQUER = process.argv.includes('--apply');
const SOURCE = 'https://data.senat.fr/data/senateurs/ODSEN_GENERAL.csv';

const sansAccents = (v) =>
  v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const compteAccents = (v) => (v.normalize('NFD').match(/[̀-ͯ]/g) ?? []).length;

/** Découpe une ligne CSV en respectant les champs entre guillemets. */
function champs(ligne) {
  const out = [];
  let courant = '';
  let dansGuillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (c === '"') {
      if (dansGuillemets && ligne[i + 1] === '"') { courant += '"'; i++; }
      else dansGuillemets = !dansGuillemets;
    } else if (c === ',' && !dansGuillemets) { out.push(courant); courant = ''; }
    else courant += c;
  }
  out.push(courant);
  return out;
}

const reponse = await fetch(SOURCE);
if (!reponse.ok) throw new Error(`ODSEN : HTTP ${reponse.status}`);
// Le fichier est en latin1, comme tous les exports du Sénat.
const texte = new TextDecoder('latin1').decode(await reponse.arrayBuffer());
const lignes = texte.split(/\r?\n/).filter((l) => l && !l.startsWith('%'));
const entete = champs(lignes[0]);
const iMat = entete.indexOf('Matricule');
const iNaiss = entete.indexOf('Date naissance');
const iCat = entete.indexOf('Catégorie professionnelle');
if (iMat < 0 || iNaiss < 0 || iCat < 0) throw new Error('colonnes ODSEN introuvables');

const source = new Map();
for (const ligne of lignes.slice(1)) {
  const c = champs(ligne);
  const mat = c[iMat]?.trim();
  if (!mat) continue;
  const brut = c[iNaiss]?.trim();
  source.set(mat, {
    naissance: brut ? new Date(`${brut.slice(0, 10)}T00:00:00Z`) : null,
    profession: c[iCat]?.trim() || null,
  });
}
console.log(`ODSEN : ${source.size} identités lues`);

const prisma = new PrismaClient();
const existants = await prisma.parlementaire.findMany({
  where: { chambre: 'senat' },
  select: { id: true, sourceId: true, nom: true, prenom: true, dateNaissance: true, profession: true },
});

let naissances = 0;
let accents = 0;
for (const p of existants) {
  if (!p.sourceId) continue;
  const s = source.get(p.sourceId);
  if (!s) continue;

  const data = {};
  if (!p.dateNaissance && s.naissance) { data.dateNaissance = s.naissance; naissances++; }
  if (
    p.profession && s.profession &&
    p.profession !== s.profession &&
    sansAccents(p.profession) === sansAccents(s.profession) &&
    compteAccents(s.profession) > compteAccents(p.profession)
  ) { data.profession = s.profession; accents++; }

  if (Object.keys(data).length > 0 && APPLIQUER) {
    await prisma.parlementaire.update({ where: { id: p.id }, data });
  }
}

console.log(`${APPLIQUER ? 'ÉCRIT' : 'À écrire'} : ${naissances} dates de naissance, ${accents} professions réaccentuées`);
await prisma.$disconnect();
