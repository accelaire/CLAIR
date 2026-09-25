// =============================================================================
// Simulation d'une soirée électorale, pour tester la chaîne de bout en bout
// =============================================================================
//
// Fabrique, à partir des vraies candidatures en base, un faux site de résultats
// au gabarit du ministère : un accueil et une page par circonscription, écrits
// dans un dossier local. L'ingestion les lit ensuite comme elle lirait le vrai
// site, ce qui exerce le parseur, le rattachement, les contrôles, l'API et les
// pages.
//
// LES RÉSULTATS SONT FICTIFS. Ils portent sur de vrais noms : ils ne doivent
// jamais quitter une base locale. La commande d'ingestion refuse d'écrire des
// pages simulées ailleurs que sur une base `localhost` (cf. cli.ts).
//
// Les étapes suivent le déroulé réel du dimanche, en heure de Paris :
//   matin    10h12  Wallis-et-Futuna seul, déjà pourvu
//   midi     14h32  1er tour du majoritaire en métropole
//   soir     19h47  2nd tours de métropole, la plupart des listes, l'outre-mer
//                    des Amériques au 1er tour
//   complet  lundi  tout, Polynésie comprise
// =============================================================================

import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import type { PrismaClient } from '@prisma/client';

export type EtapeSimulation = 'matin' | 'midi' | 'soir' | 'complet';

export const HORLOGE_ETAPE: Record<EtapeSimulation, string> = {
  matin: '2026-09-27T10:12:00+02:00',
  midi: '2026-09-27T14:32:00+02:00',
  soir: '2026-09-27T19:47:00+02:00',
  complet: '2026-09-28T06:10:00+02:00',
};

const PACIFIQUE_TOT = new Set(['986']);
const AMERIQUES = new Set(['973', '977', '978']);
const POLYNESIE = new Set(['987']);

/** Générateur pseudo-aléatoire déterministe, pour que deux passages rendent la même soirée. */
function generateur(graine: string): () => number {
  let h = 2166136261;
  for (const c of graine) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function nombre(n: number): string {
  return n.toLocaleString('fr-FR').replace(/\u202f/g, ' ');
}
function pct(part: number, total: number): string {
  return total === 0 ? '0,00' : ((part / total) * 100).toFixed(2).replace('.', ',');
}
function echapper(texte: string): string {
  return texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

interface Unite {
  numeroDepot: number;
  libelle: string | null;
  nuance: string | null;
  titulaire: string;
}

interface Participation {
  inscrits: number;
  abstentions: number;
  votants: number;
  blancs: number;
  nuls: number;
  exprimes: number;
}

function participation(inscrits: number, alea: () => number): Participation {
  const abstentions = Math.round(inscrits * (0.005 + alea() * 0.02));
  const votants = inscrits - abstentions;
  const blancs = Math.round(votants * (0.003 + alea() * 0.012));
  const nuls = Math.round(votants * (0.002 + alea() * 0.008));
  return { inscrits, abstentions, votants, blancs, nuls, exprimes: votants - blancs - nuls };
}

function tableauMentions(tour: 1 | 2, p: Participation): string {
  const suffixe = tour === 1 ? '1er tour' : '2nd tour';
  const ligne = (libelle: string, n: number, pi: string, pv: string) =>
    `<tr><td>${libelle}</td><td>${nombre(n)}</td><td>${pi}</td><td>${pv}</td></tr>`;
  return `<table><caption role="heading" aria-level="4">Mentions ${suffixe}</caption>
<thead><tr><td></td><th scope="col">Nombre</th><th scope="col">% Inscrits</th><th scope="col">% Votants</th></tr></thead>
<tbody>
${ligne('Inscrits', p.inscrits, '', '')}
${ligne('Abstentions', p.abstentions, pct(p.abstentions, p.inscrits), '')}
${ligne('Votants', p.votants, pct(p.votants, p.inscrits), '')}
${ligne('Blancs', p.blancs, pct(p.blancs, p.inscrits), pct(p.blancs, p.votants))}
${ligne('Nuls', p.nuls, pct(p.nuls, p.inscrits), pct(p.nuls, p.votants))}
${ligne('Exprimés', p.exprimes, pct(p.exprimes, p.inscrits), pct(p.exprimes, p.votants))}
</tbody></table>`;
}

/** Répartition à la plus forte moyenne, comme au proportionnel sénatorial. */
function plusForteMoyenne(voix: number[], sieges: number): number[] {
  const attribues = voix.map(() => 0);
  for (let s = 0; s < sieges; s++) {
    let meilleur = 0;
    const moyenne = (i: number) => (voix[i] ?? 0) / ((attribues[i] ?? 0) + 1);
    for (let i = 1; i < voix.length; i++) {
      if (moyenne(i) > moyenne(meilleur)) meilleur = i;
    }
    attribues[meilleur] = (attribues[meilleur] ?? 0) + 1;
  }
  return attribues;
}

function pageProportionnel(unites: Unite[], sieges: number, inscrits: number, alea: () => number, publie: boolean): string {
  const entete = `<h3>Résultats tour 1</h3><h4 class="fr-h3">Sièges à pourvoir : ${sieges}</h4>`;
  if (!publie) return entete;

  const p = participation(inscrits, alea);
  const poids = unites.map(() => Math.pow(alea(), 2.2) + 0.02);
  const somme = poids.reduce((a, b) => a + b, 0);
  const voix = poids.map((w) => Math.floor((w / somme) * p.exprimes));
  voix[0] = (voix[0] ?? 0) + p.exprimes - voix.reduce((a, b) => a + b, 0);
  const attribues = plusForteMoyenne(voix, sieges);

  const ordre = unites
    .map((u, i) => ({ u, voix: voix[i] ?? 0, sieges: attribues[i] ?? 0 }))
    .sort((a, b) => b.voix - a.voix);
  const lignes = ordre
    .map(
      ({ u, voix: v, sieges: s }) =>
        `<tr onclick="parent.document.location.href='./rappel_candidature/1/${u.numeroDepot}.html'">
<td><a href="./rappel_candidature/1/${u.numeroDepot}.html">${echapper(u.libelle ?? '')}</a></td>
<td>${u.nuance ?? ''}</td><td>${nombre(v)}</td><td>${pct(v, p.inscrits)}</td><td>${pct(v, p.exprimes)}</td><td>${s}</td></tr>`
    )
    .join('\n');

  return `${entete}
<table><caption role="heading" aria-level="4">Résultats<sup>*</sup> au 1<sup>er</sup> tour</caption>
<thead><tr><th scope="col">Liste des candidatures</th><th scope="col">Nuance</th><th scope="col">Voix</th><th scope="col">% Inscrits</th><th scope="col">% Exprimés</th><th scope="col">Sièges</th></tr></thead>
<tbody>${lignes}</tbody></table>
${tableauMentions(1, p)}`;
}

function tableauMajoritaire(tour: 1 | 2, rappel: boolean, lignes: { u: Unite; voix: number; elu: boolean }[], p: Participation): string {
  const legende = rappel
    ? `Rappel des résultats au 1<sup>er</sup> tour`
    : tour === 1
      ? `Résultats<sup>*</sup> au 1<sup>er</sup> tour`
      : `Résultats<sup>*</sup> au 2<sup>nd</sup> tour`;
  const corps = [...lignes]
    .sort((a, b) => b.voix - a.voix)
    .map(
      (l) =>
        `<tr><td>${echapper(l.u.titulaire)}</td><td>${l.u.nuance ?? ''}</td><td>${nombre(l.voix)}</td><td>${pct(l.voix, p.inscrits)}</td><td>${pct(l.voix, p.exprimes)}</td><td>${l.elu ? 'OUI' : 'NON'}</td></tr>`
    )
    .join('\n');
  return `<table><caption role="heading" aria-level="4">${legende}</caption>
<thead><tr><th scope="col">Liste des candidats</th><th scope="col">Nuance</th><th scope="col">Voix</th><th scope="col">% Inscrits</th><th scope="col">% Exprimés</th><th scope="col">Elu(e)</th></tr></thead>
<tbody>${corps}</tbody></table>
${tableauMentions(tour, p)}`;
}

function pageMajoritaire(
  unites: Unite[],
  sieges: number,
  inscrits: number,
  alea: () => number,
  tours: 0 | 1 | 2
): string {
  const entete = (tour: number) => `<h3>Résultats tour ${tour}</h3><h4 class="fr-h3">Sièges à pourvoir : ${sieges}</h4>`;
  if (tours === 0) return entete(1);

  // 1er tour : un grand électeur vote pour autant de noms que de sièges. Un
  // tiers des circonscriptions environ désigne un élu dès ce tour.
  const p1 = participation(inscrits, alea);
  const dominant = alea() < 0.4;
  const poids = unites.map((_, i) => (i === 0 && dominant ? 3.2 : Math.pow(alea(), 1.6) + 0.05));
  const somme = poids.reduce((a, b) => a + b, 0);
  const capacite = p1.exprimes * (sieges === 1 ? 1 : 1.7);
  let voix1 = poids.map((w) => Math.floor((w / somme) * capacite));
  // Mélange pour que le candidat dominant ne soit pas toujours le premier déposé.
  const decalage = Math.floor(alea() * unites.length);
  voix1 = voix1.map((_, i) => voix1[(i + decalage) % voix1.length] ?? 0);

  const eligiblesT1 = voix1
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => v > p1.exprimes / 2 && v >= p1.inscrits / 4)
    .sort((a, b) => b.v - a.v)
    .slice(0, sieges);
  const elusT1 = new Set(eligiblesT1.map((e) => e.i));
  const lignesT1 = unites.map((u, i) => ({ u, voix: voix1[i] ?? 0, elu: elusT1.has(i) }));

  if (elusT1.size === sieges || tours === 1) {
    return `${entete(1)}\n${tableauMajoritaire(1, false, lignesT1, p1)}`;
  }

  // 2nd tour : les mieux placés restants, majorité relative.
  const restants = sieges - elusT1.size;
  const candidatsT2 = voix1
    .map((v, i) => ({ v, i }))
    .filter(({ i }) => !elusT1.has(i))
    .sort((a, b) => b.v - a.v)
    .slice(0, Math.max(restants + 2, 3));
  const p2 = participation(inscrits, alea);
  const poids2 = candidatsT2.map(({ v }) => v * (0.6 + alea() * 0.8));
  const somme2 = poids2.reduce((a, b) => a + b, 0);
  const capacite2 = p2.exprimes * (restants === 1 ? 1 : 1.6);
  const voix2 = poids2.map((w) => Math.floor((w / somme2) * capacite2));
  const gagnants = new Set(
    voix2
      .map((v, k) => ({ v, k }))
      .sort((a, b) => b.v - a.v)
      .slice(0, restants)
      .map((x) => x.k)
  );
  const lignesT2 = candidatsT2.flatMap(({ i }, k) => {
    const u = unites[i];
    return u ? [{ u, voix: voix2[k] ?? 0, elu: gagnants.has(k) }] : [];
  });

  return `${entete(2)}
${tableauMajoritaire(2, false, lignesT2, p2)}
${tableauMajoritaire(1, true, lignesT1, p1)}`;
}

/** Ce qui est publié pour une circonscription à une étape donnée. */
function publication(code: string, mode: string, etape: EtapeSimulation, alea: () => number): 0 | 1 | 2 {
  if (etape === 'complet') return 2;
  if (PACIFIQUE_TOT.has(code)) return 2;
  if (POLYNESIE.has(code)) return 0;
  if (etape === 'matin') return 0;

  if (mode === 'majoritaire') {
    if (AMERIQUES.has(code)) return etape === 'soir' ? 1 : 0;
    return etape === 'midi' ? 1 : 2;
  }
  // Proportionnel : rien avant la clôture de 17h30, puis environ quatre sur
  // cinq publiés à 19h47.
  if (etape === 'midi') return 0;
  return alea() < 0.8 ? 2 : 0;
}

export async function genererSiteSimule(
  prisma: PrismaClient,
  options: { scrutin: string; etape: EtapeSimulation; dossier: string }
): Promise<{ pages: number; publiees: number }> {
  const listes = await prisma.candidatureListe.findMany({
    where: { scrutin: options.scrutin },
    orderBy: { numeroDepot: 'asc' },
    select: {
      numeroDepot: true,
      libelle: true,
      nuance: true,
      modeScrutin: true,
      circonscription: { select: { departement: true, nom: true } },
      candidatures: {
        where: { role: 'titulaire', ordre: 1 },
        select: { nom: true, prenom: true, sexe: true },
      },
    },
  });
  const sieges = await prisma.$queryRaw<{ departement: string; n: bigint }[]>`
    SELECT c.departement, COUNT(*)::bigint AS n
    FROM mandats_parlementaires m
    JOIN circonscriptions c ON c.id = m.circonscription_id
    WHERE m.chambre = 'senat' AND m.serie = '2' AND m.mandature = 2020
      AND m.date_debut <= '2026-09-26' AND (m.date_fin IS NULL OR m.date_fin >= '2026-09-26')
    GROUP BY c.departement
  `;
  const siegesParCode = new Map(sieges.map((s) => [s.departement, Number(s.n)]));

  const parCode = new Map<string, { nom: string; mode: string; unites: Unite[] }>();
  for (const l of listes) {
    const code = l.circonscription.departement;
    const circo = parCode.get(code) ?? { nom: l.circonscription.nom, mode: l.modeScrutin, unites: [] };
    const t = l.candidatures[0];
    circo.unites.push({
      numeroDepot: l.numeroDepot ?? circo.unites.length + 1,
      libelle: l.libelle,
      nuance: l.nuance,
      titulaire: t ? `${t.sexe === 'F' ? 'Mme' : 'M.'} ${t.prenom} ${t.nom}` : '',
    });
    parCode.set(code, circo);
  }

  let publiees = 0;
  const options_ = [];
  for (const [code, circo] of parCode) {
    const alea = generateur(`${options.scrutin}:${code}`);
    const nbSieges = siegesParCode.get(code) ?? 1;
    const inscrits = Math.round((350 + alea() * 900) * Math.max(1, nbSieges * 0.8));
    const segment = code === '997' ? 'ZZ' : code;
    const relatif = `ensemble_geographique/${segment}/index.html`;
    const etat = publication(code, circo.mode, options.etape, alea);
    if (etat > 0) publiees++;

    const corps =
      circo.mode === 'proportionnel'
        ? pageProportionnel(circo.unites, nbSieges, inscrits, alea, etat > 0)
        : pageMajoritaire(circo.unites, nbSieges, inscrits, alea, etat);

    const fichier = path.join(options.dossier, relatif);
    await mkdir(path.dirname(fichier), { recursive: true });
    await writeFile(
      fichier,
      `<!doctype html><html lang="fr"><body><p>SIMULATION — RÉSULTATS FICTIFS</p>\n${corps}\n</body></html>\n`
    );
    options_.push(`<option value="./${relatif}">${segment} - ${echapper(circo.nom)}</option>`);
  }

  await mkdir(options.dossier, { recursive: true });
  await writeFile(
    path.join(options.dossier, 'index.html'),
    `<!doctype html><html lang="fr"><body><p>SIMULATION — RÉSULTATS FICTIFS</p><select id="selectDep"><option value="" selected disabled hidden>Choisir un département</option>\n${options_.join('\n')}\n</select></body></html>\n`
  );

  return { pages: parCode.size, publiees };
}
