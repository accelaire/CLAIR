// =============================================================================
// Renvois vers les fiches CLAIR des personnes citées dans un texte source
// =============================================================================
//
// Un texte venu d'une source (réponse officielle d'une pétition, point d'ordre
// du jour) cite des parlementaires de deux façons :
//  - un lien vers leur fiche officielle (`senat.fr/senateur/…19629c.html`,
//    `assemblee-nationale.fr/dyn/deputes/PA794354`) : résolu par
//    l'identifiant de la chambre, sans ambiguïté possible ;
//  - leur nom après une civilité (« Mme Hélène Laporte », « M. Patrick
//    CHAIZE ») : résolu seulement si prénom et nom, accents et casse mis à
//    part, désignent exactement UNE personne connue (parlementaire, ou membre
//    du Gouvernement sans fiche de parlementaire). Jamais d'inclusion ni de
//    nom approchant : « M. Gérard LESEUR » (pour Leseul) reste du texte.
//
// Le texte n'est pas réécrit : la réponse liste les renvois, le client les
// pose. Un consommateur de l'API garde ainsi les liens officiels.
// =============================================================================

import type { PrismaClient } from '@prisma/client';

export interface RenvoiPersonne {
  /** `lien` : l'URL officielle telle qu'écrite ; `nom` : le nom tel qu'écrit, sans la civilité. */
  type: 'lien' | 'nom';
  cle: string;
  /** Chemin de la fiche sur CLAIR (`/senateurs/maryse-carrere`). */
  chemin: string;
}

type Chambre = 'assemblee' | 'senat';

export interface LienOfficiel {
  url: string;
  chambre: Chambre;
  sourceId: string;
}

const LIEN_SENAT = /https?:\/\/(?:www\.)?senat\.fr\/senateur\/[a-z0-9_]*?(\d{5}[a-z])\.html/gi;
const LIEN_AN =
  /https?:\/\/(?:www2?\.)?assemblee-nationale\.fr\/(?:dyn\/deputes\/(PA\d+)|(?:\d+\/)?tribun\/fiches_id\/(\d+)\.asp|deputes\/fiche\/OMC_(PA\d+))/gi;

/** Liens vers une fiche de sénateur ou de député, avec l'identifiant de la chambre. */
export function liensOfficiels(texte: string): LienOfficiel[] {
  const liens: LienOfficiel[] = [];
  for (const m of texte.matchAll(LIEN_SENAT)) {
    liens.push({ url: m[0], chambre: 'senat', sourceId: m[1]!.toUpperCase() });
  }
  for (const m of texte.matchAll(LIEN_AN)) {
    const pa = m[1] ?? m[3] ?? `PA${m[2]}`;
    liens.push({ url: m[0], chambre: 'assemblee', sourceId: pa.toUpperCase() });
  }
  return liens;
}

/** Forme de comparaison d'un nom : sans accents, en minuscules, tirets et apostrophes unifiés. */
export function formeDuNom(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[-\s]+/g, ' ')
    .trim();
}

const CIVILITE = /(?<![\p{L}])(?:Mme|Mlle|M\.|Madame|Monsieur)\s+/gu;
const PARTICULE = /^(?:de|du|des|la|le|van|von|di|da|del|d['’]\p{L}[\p{L}'’-]*)$/u;
const MOT_DU_NOM = /^\p{Lu}[\p{L}'’-]*$/u;
const MOTS_MAX = 6;

/**
 * Noms cités après une civilité, en candidats du plus long au plus court
 * (deux mots au moins : un prénom et un nom). « Mme Sonia de LA PROVÔTÉ,
 * sénatrice » donne « Sonia de LA PROVÔTÉ », « Sonia de LA », « Sonia de ».
 */
export function nomsCites(texte: string): string[][] {
  const resultats: string[][] = [];
  for (const m of texte.matchAll(CIVILITE)) {
    const suite = texte.slice(m.index! + m[0].length);
    const mots: string[] = [];
    for (const brut of suite.split(/\s+/).slice(0, MOTS_MAX)) {
      // Ponctuation finale : le nom s'arrête après ce mot.
      const mot = brut.replace(/[,;:.)\]»"]+$/, '');
      if (!mot || !(MOT_DU_NOM.test(mot) || (mots.length > 0 && PARTICULE.test(mot)))) break;
      mots.push(mot);
      if (mot !== brut) break;
    }
    const candidats: string[] = [];
    for (let n = mots.length; n >= 2; n--) candidats.push(mots.slice(0, n).join(' '));
    if (candidats.length > 0) resultats.push(candidats);
  }
  return resultats;
}

const cheminParlementaire = (p: { chambre: string; slug: string }) =>
  `/${p.chambre === 'senat' ? 'senateurs' : 'deputes'}/${p.slug}`;

/** Les renvois des personnes citées dans ces textes, chaque clé une fois. */
export async function renvoisPersonnes(prisma: PrismaClient, textes: readonly string[]): Promise<RenvoiPersonne[]> {
  const liens = textes.flatMap(liensOfficiels);
  const noms = textes.flatMap(nomsCites);
  const renvois = new Map<string, RenvoiPersonne>();

  if (liens.length > 0) {
    const paires = liens.map((l) => ({ chambre: l.chambre, sourceId: l.sourceId }));
    const [fiches, anciens] = await Promise.all([
      prisma.parlementaire.findMany({ where: { OR: paires }, select: { chambre: true, sourceId: true, slug: true } }),
      // L'identifiant qu'une personne garde dans la chambre qu'elle a quittée.
      prisma.parlementaireIdentifiant.findMany({
        where: { OR: paires },
        select: { chambre: true, sourceId: true, personne: { select: { chambre: true, slug: true } } },
      }),
    ]);
    const parId = new Map<string, string>();
    for (const a of anciens) parId.set(`${a.chambre}:${a.sourceId}`, cheminParlementaire(a.personne));
    for (const f of fiches) if (f.sourceId) parId.set(`${f.chambre}:${f.sourceId}`, cheminParlementaire(f));
    for (const l of liens) {
      const chemin = parId.get(`${l.chambre}:${l.sourceId}`);
      if (chemin) renvois.set(`lien:${l.url}`, { type: 'lien', cle: l.url, chemin });
    }
  }

  if (noms.length > 0) {
    const [parlementaires, membres] = await Promise.all([
      prisma.parlementaire.findMany({ select: { prenom: true, nom: true, chambre: true, slug: true } }),
      prisma.membreGouvernement.findMany({ where: { parlementaireId: null }, select: { prenom: true, nom: true, slug: true } }),
    ]);
    // Une forme qui mène à deux fiches différentes n'est pas résolue.
    const index = new Map<string, Set<string>>();
    const ajouter = (prenom: string, nom: string, chemin: string) => {
      const cle = formeDuNom(`${prenom} ${nom}`);
      if (!index.has(cle)) index.set(cle, new Set());
      index.get(cle)!.add(chemin);
    };
    for (const p of parlementaires) ajouter(p.prenom, p.nom, cheminParlementaire(p));
    for (const m of membres) ajouter(m.prenom, m.nom, `/gouvernements/membres/${m.slug}`);

    for (const candidats of noms) {
      for (const nom of candidats) {
        const chemins = index.get(formeDuNom(nom));
        if (!chemins) continue;
        if (chemins.size === 1) renvois.set(`nom:${nom}`, { type: 'nom', cle: nom, chemin: [...chemins][0]! });
        break;
      }
    }
  }

  return [...renvois.values()];
}
