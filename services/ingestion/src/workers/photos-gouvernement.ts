// =============================================================================
// Photos des membres du Gouvernement sans fiche (Wikidata + Wikimedia Commons)
//
// 166 des 311 membres du Gouvernement depuis 2007 n'ont ni fiche de député ni
// fiche de sénateur, donc pas de photo : aucune source officielle ne publie leur
// portrait (#136). Wikidata donne l'image principale d'une personne (P18), un
// fichier de Commons sous licence libre.
//
// Rapprochement sûr ou rien. Une personne de Wikidata n'est retenue que si :
// - c'est un humain (P31 = Q5) qui porte exactement ce prénom et ce nom
//   (libellé ou alias) ;
// - au moins une preuve la relie au membre : l'identifiant de l'Assemblée
//   (P4123) du membre, sa date de naissance au jour près (AMO30), ou une
//   fonction (P39) qui commence à un mois près de l'un de ses postes ;
// - rien ne la contredit : ni un autre identifiant de l'Assemblée, ni une
//   autre date de naissance ;
// - elle est la seule dans ce cas.
// Exemple du 15/11/2026 : l'identifiant de l'Assemblée de Philippe Baptiste,
// ministre né en 1972, est posé sur Wikidata sur un homonyme né en 1973 ; la
// date de naissance écarte l'homonyme, la date d'entrée au Gouvernement
// désigne le ministre.
//
// La personne retenue est gardée (`wikidata_id`) : elle n'est plus recherchée.
// La photo n'est écrite qu'avec son crédit (auteur, licence) et sous une
// licence de la liste ci-dessous.
//
// Wikidata est modifiable par tous, et la photo d'un responsable politique est
// une cible de vandalisme. D'où deux règles :
// - une image n'est adoptée que si c'était déjà l'image principale de la
//   personne il y a 7 jours (révision de Wikidata à cette date) : un vandalisme
//   récent donne une autre image que l'ancienne. La date de dernière
//   modification ne convient pas : les robots modifient les fiches suivies
//   presque chaque jour (41 personnes sur 150, dont Emmanuel Macron, le
//   15/11/2026) ;
// - une photo retenue est FIGÉE : le passage de nuit ne la remplace jamais. Il
//   ne la retire que si son fichier disparaît de Commons. `--actualiser` (à la
//   main, résultat à relire) relit image et crédit.
// Rien n'est jamais effacé sur une lecture ratée.
// =============================================================================

import type { PrismaClient } from '@prisma/client';
import pLimit from 'p-limit';
import { logger } from '../utils/logger';
import { errorMessage } from '../utils/errors';
import { normaliserNom } from '../utils/rapprochement-fiche';
import { wikidataGet } from '../sources/wikidata/client';
import { lireImagesCommons, type ImageCommons, type ImagesCommons } from '../sources/wikidata/commons-client';

const CONCURRENCE = 2;
/** Nouvelles tentatives après un 429 de Wikidata, qui freine les rafales */
const REPRISES = 3;
const PAR_REQUETE = 50;
/** Écart toléré entre le début d'une fonction sur Wikidata et celui d'un poste */
const ECART_DEBUT_POSTE_JOURS = 31;
const JOUR_MS = 86_400_000;
/**
 * Une image n'est adoptée que si elle était déjà l'image principale de la
 * personne il y a ce nombre de jours : un vandalisme est le plus souvent
 * annulé avant.
 */
const DELAI_STABILITE_JOURS = 7;

// -----------------------------------------------------------------------------
// Lecture des entités Wikidata
// -----------------------------------------------------------------------------

interface WbSnak {
  datavalue?: { value?: unknown };
}
interface WbClaim {
  rank?: 'preferred' | 'normal' | 'deprecated';
  mainsnak?: WbSnak;
  qualifiers?: Record<string, WbSnak[]>;
}
export interface WbEntite {
  id?: string;
  missing?: string;
  labels?: Record<string, { value: string }>;
  aliases?: Record<string, Array<{ value: string }>>;
  claims?: Record<string, WbClaim[]>;
}

/** Date de Wikidata : `+1972-03-28T00:00:00Z`, précision 11 = jour, 9 = année. */
interface DateWd {
  iso: string; // YYYY-MM-DD, ou YYYY si la précision est l'année
  precision: number;
}

export interface Candidat {
  qid: string;
  humain: boolean;
  /** Prénoms-noms normalisés (libellés et alias) */
  noms: string[];
  naissances: DateWd[];
  identifiantsAN: string[];
  /** Débuts des fonctions occupées (P39), au jour près seulement */
  debutsFonctions: string[];
}

const LANGUES = ['fr', 'mul', 'en'];

function declarations(e: WbEntite, propriete: string): WbClaim[] {
  return (e.claims?.[propriete] ?? []).filter((c) => c.rank !== 'deprecated');
}

function dateWd(snak: WbSnak | undefined): DateWd | null {
  const v = snak?.datavalue?.value as { time?: string; precision?: number } | undefined;
  const m = /^[+]?(\d{4})-(\d{2})-(\d{2})/.exec(v?.time ?? '');
  if (!m || v?.precision === undefined) return null;
  if (v.precision >= 11 && m[2] !== '00' && m[3] !== '00') return { iso: `${m[1]}-${m[2]}-${m[3]}`, precision: 11 };
  if (v.precision >= 9) return { iso: m[1]!, precision: 9 };
  return null;
}

export function candidatDepuisEntite(e: WbEntite): Candidat {
  const noms = new Set<string>();
  for (const l of LANGUES) {
    if (e.labels?.[l]) noms.add(normaliserNom(e.labels[l]!.value));
    for (const a of e.aliases?.[l] ?? []) noms.add(normaliserNom(a.value));
  }
  return {
    qid: e.id!,
    humain: declarations(e, 'P31').some((c) => (c.mainsnak?.datavalue?.value as { id?: string })?.id === 'Q5'),
    noms: [...noms],
    naissances: declarations(e, 'P569').map((c) => dateWd(c.mainsnak)).filter((d): d is DateWd => d !== null),
    identifiantsAN: declarations(e, 'P4123')
      .map((c) => c.mainsnak?.datavalue?.value)
      .filter((v): v is string => typeof v === 'string'),
    debutsFonctions: declarations(e, 'P39').flatMap((c) =>
      (c.qualifiers?.P580 ?? [])
        .map(dateWd)
        .filter((d): d is DateWd => d !== null && d.precision === 11)
        .map((d) => d.iso),
    ),
  };
}

/** Image principale (P18) : la déclaration de rang privilégié, sinon la première. */
export function imagePrincipale(e: WbEntite): string | null {
  const images = declarations(e, 'P18');
  const choisie = images.find((c) => c.rank === 'preferred') ?? images[0];
  const v = choisie?.mainsnak?.datavalue?.value;
  return typeof v === 'string' && v.length > 0 ? v : null;
}

// -----------------------------------------------------------------------------
// Rapprochement
// -----------------------------------------------------------------------------

export interface MembreARapprocher {
  acteurUid: string;
  prenom: string;
  nom: string;
  dateNaissance: Date | null;
  debutsPostes: Date[];
}

export type Preuve = 'identifiant_an' | 'naissance' | 'debut_poste';

export type Rapprochement =
  | { qid: string; preuves: Preuve[] }
  | { qid: null; motif: 'aucun' | 'ambigu'; candidats: string[] };

const jour = (d: Date): string => d.toISOString().slice(0, 10);

export function rapprocher(membre: MembreARapprocher, candidats: readonly Candidat[]): Rapprochement {
  const nom = normaliserNom(`${membre.prenom} ${membre.nom}`);
  const naissance = membre.dateNaissance ? jour(membre.dateNaissance) : null;
  // L'identifiant de l'acteur (PA855049) s'écrit sans préfixe sur Wikidata.
  const identifiantAN = membre.acteurUid.replace(/^PA/, '');
  const debutsPostes = membre.debutsPostes.map((d) => d.getTime());

  const retenus: Array<{ qid: string; preuves: Preuve[] }> = [];
  for (const c of candidats) {
    if (!c.humain || !c.noms.includes(nom)) continue;

    // Contradictions : un autre député, une autre date de naissance.
    if (c.identifiantsAN.length > 0 && !c.identifiantsAN.includes(identifiantAN)) continue;
    if (
      naissance &&
      c.naissances.length > 0 &&
      !c.naissances.some((d) => (d.precision === 11 ? d.iso === naissance : naissance.startsWith(d.iso)))
    ) {
      continue;
    }

    const preuves: Preuve[] = [];
    if (c.identifiantsAN.includes(identifiantAN)) preuves.push('identifiant_an');
    if (naissance && c.naissances.some((d) => d.precision === 11 && d.iso === naissance)) preuves.push('naissance');
    const debutPoste = c.debutsFonctions.some((iso) => {
      const t = Date.parse(`${iso}T00:00:00Z`);
      return debutsPostes.some((p) => Math.abs(t - p) <= ECART_DEBUT_POSTE_JOURS * JOUR_MS);
    });
    if (debutPoste) preuves.push('debut_poste');
    if (preuves.length > 0) retenus.push({ qid: c.qid, preuves });
  }

  if (retenus.length === 1) return retenus[0]!;
  return { qid: null, motif: retenus.length > 1 ? 'ambigu' : 'aucun', candidats: retenus.map((r) => r.qid) };
}

// -----------------------------------------------------------------------------
// Licences
// -----------------------------------------------------------------------------

/** Licences libres acceptées, telles que Commons les nomme (`LicenseShortName`). */
const LICENCES_ACCEPTEES: readonly RegExp[] = [
  /^CC0( 1\.0)?$/i,
  /^CC BY(-SA)? \d\.\d( [a-z]{2,3})?$/i,
  /^Public domain$/i,
  /^Licence Ouverte( \d\.\d)?$/i,
  /^Attribution$/i,
];
const SANS_AUTEUR_REQUIS = /^(CC0|Public domain)/i;
/** Au-delà, le champ auteur de Commons est un texte de consignes, pas un crédit affichable. */
const AUTEUR_LONGUEUR_MAX = 150;

/**
 * Vrai si la photo peut être affichée : licence de la liste, et crédit court
 * et connu quand la licence l'exige.
 */
export function creditValide(image: ImageCommons): boolean {
  if (!image.licence || !LICENCES_ACCEPTEES.some((r) => r.test(image.licence!))) return false;
  if (image.auteur !== null && image.auteur.length > AUTEUR_LONGUEUR_MAX) return false;
  return image.auteur !== null || SANS_AUTEUR_REQUIS.test(image.licence);
}

// -----------------------------------------------------------------------------
// Synchronisation
// -----------------------------------------------------------------------------

interface ValeursPhoto {
  photoUrl: string | null;
  photoAuteur: string | null;
  photoLicence: string | null;
  photoLicenceUrl: string | null;
  photoSource: string | null;
}
const SANS_PHOTO: ValeursPhoto = { photoUrl: null, photoAuteur: null, photoLicence: null, photoLicenceUrl: null, photoSource: null };

function valeursDepuisImage(image: ImageCommons): ValeursPhoto {
  return {
    photoUrl: image.vignette,
    photoAuteur: image.auteur,
    photoLicence: image.licence,
    photoLicenceUrl: image.licenceUrl,
    photoSource: image.page,
  };
}

export interface RapportPhotosGouvernement {
  /** Membres sans fiche */
  membres: number;
  /** Personnes de Wikidata retenues à ce passage */
  rapproches: number;
  /** Membres sans personne retenue : aucun candidat sûr, ou plusieurs */
  sansRapprochement: number;
  ambigus: number;
  /** Membres avec une photo après ce passage */
  avecPhoto: number;
  /** Photos figées laissées telles quelles */
  figees: number;
  /** Nouvelles photos différées : pas encore l'image principale de la personne il y a 7 jours */
  adoptionsDifferees: number;
  /** Photos figées retirées : fichier supprimé de Commons */
  fichiersSupprimes: number;
  /** Personne retenue sans image sur Wikidata */
  sansImage: number;
  /** Images écartées : licence hors liste, ou auteur inconnu */
  creditsRefuses: number;
  /** Lignes modifiées (personne retenue ou photo) */
  modifies: number;
  /** Lectures ratées : rien n'est effacé, retenté au prochain passage */
  erreurs: number;
}

interface Membre {
  id: string;
  acteurUid: string;
  prenom: string;
  nom: string;
  dateNaissance: Date | null;
  wikidataId: string | null;
  photoUrl: string | null;
  photoAuteur: string | null;
  photoLicence: string | null;
  photoLicenceUrl: string | null;
  photoSource: string | null;
  postes: Array<{ dateDebut: Date }>;
}

async function chargerEntites(ids: readonly string[], props: string): Promise<Map<string, WbEntite>> {
  const resultat = new Map<string, WbEntite>();
  for (let i = 0; i < ids.length; i += PAR_REQUETE) {
    const lot = ids.slice(i, i + PAR_REQUETE);
    const json = await wikidataGet<{ entities?: Record<string, WbEntite> }>({
      action: 'wbgetentities',
      ids: lot.join('|'),
      props,
      languages: LANGUES.join('|'),
    }, { reprises: REPRISES });
    if (!json?.entities) throw new Error('Wikidata : réponse vide à wbgetentities');
    for (const [id, e] of Object.entries(json.entities)) resultat.set(id, e);
  }
  return resultat;
}

/**
 * Image principale d'une personne dans la révision de Wikidata en vigueur à
 * `date`. `null` : pas d'image, ou la personne n'existait pas encore sur
 * Wikidata ; `undefined` : lecture ratée.
 */
export async function imageIlYA(qid: string, date: Date): Promise<string | null | undefined> {
  const json = await wikidataGet<{
    query?: { pages?: Array<{ missing?: boolean; revisions?: Array<{ slots?: { main?: { content?: string } } }> }> };
  }>({
    action: 'query',
    prop: 'revisions',
    titles: qid,
    rvstart: date.toISOString(),
    rvlimit: '1',
    rvprop: 'content',
    rvslots: 'main',
    formatversion: '2',
  }, { reprises: REPRISES });
  const page = json?.query?.pages?.[0];
  if (!page) return undefined;
  const contenu = page.revisions?.[0]?.slots?.main?.content;
  if (page.missing || !contenu) return null;
  try {
    return imagePrincipale(JSON.parse(contenu) as WbEntite);
  } catch {
    return undefined;
  }
}

/** Cherche la personne de Wikidata d'un membre. `undefined` : lecture ratée. */
async function chercher(m: Membre): Promise<Rapprochement | undefined> {
  const recherche = await wikidataGet<{ search?: Array<{ id: string }> }>({
    action: 'wbsearchentities',
    search: `${m.prenom} ${m.nom}`,
    language: 'fr',
    uselang: 'fr',
    type: 'item',
    limit: '10',
  }, { reprises: REPRISES });
  if (!recherche) return undefined;
  const ids = (recherche.search ?? []).map((s) => s.id);
  if (ids.length === 0) return { qid: null, motif: 'aucun', candidats: [] };
  const entites = await chargerEntites(ids, 'labels|aliases|claims');
  const candidats = ids
    .map((id) => entites.get(id))
    .filter((e): e is WbEntite => !!e && !e.missing && !!e.id)
    .map(candidatDepuisEntite);
  return rapprocher(
    { acteurUid: m.acteurUid, prenom: m.prenom, nom: m.nom, dateNaissance: m.dateNaissance, debutsPostes: m.postes.map((p) => p.dateDebut) },
    candidats,
  );
}

export interface OptionsPhotosGouvernement {
  dryRun?: boolean;
  /** Refaire la recherche des membres déjà rapprochés (lancé à la main) */
  rapprocherDeNouveau?: boolean;
  /** Relire l'image et le crédit des photos figées (lancé à la main, à relire) */
  actualiser?: boolean;
  /** Horloge, pour les tests */
  maintenant?: Date;
  journal?: (ligne: string) => void;
}

/** Nom du fichier de Commons d'une page de fichier (`…/wiki/File:Pap_Ndiaye.jpg`). */
export function fichierDepuisPage(page: string | null): string | null {
  const m = /\/wiki\/File:(.+)$/.exec(page ?? '');
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]!).replace(/_/g, ' ');
  } catch {
    return null;
  }
}

export async function syncPhotosGouvernement(
  prisma: PrismaClient,
  options: OptionsPhotosGouvernement = {},
): Promise<RapportPhotosGouvernement> {
  const journal = options.journal ?? (() => {});
  const maintenant = options.maintenant ?? new Date();
  const membres: Membre[] = await prisma.membreGouvernement.findMany({
    where: { parlementaireId: null },
    select: {
      id: true, acteurUid: true, prenom: true, nom: true, dateNaissance: true, wikidataId: true,
      photoUrl: true, photoAuteur: true, photoLicence: true, photoLicenceUrl: true, photoSource: true,
      postes: { select: { dateDebut: true } },
    },
    orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
  });

  const rapport: RapportPhotosGouvernement = {
    membres: membres.length, rapproches: 0, sansRapprochement: 0, ambigus: 0, avecPhoto: 0, figees: 0,
    adoptionsDifferees: 0, fichiersSupprimes: 0, sansImage: 0, creditsRefuses: 0, modifies: 0, erreurs: 0,
  };

  // Une photo retenue est figée : Wikidata est modifiable par tous, et la photo
  // d'un responsable politique est une cible de vandalisme. Le passage de nuit
  // ne la remplace jamais ; il ne l'efface que si son fichier disparaît de
  // Commons (retrait pour droits d'auteur, le plus souvent). Seules les
  // commandes lancées à la main la remettent en jeu.
  const figee = (m: Membre) => m.photoUrl !== null && !options.actualiser && !options.rapprocherDeNouveau;

  // 1) Personne de Wikidata des membres qui n'en ont pas encore. `undefined` :
  //    on ne sait pas (lecture ratée), on garde l'état de la base.
  const qid = new Map<string, string | null | undefined>(membres.map((m) => [m.id, m.wikidataId]));
  const limite = pLimit(CONCURRENCE);
  await Promise.all(
    membres
      .filter((m) => !figee(m) && (!m.wikidataId || options.rapprocherDeNouveau))
      .map((m) =>
        limite(async () => {
          let r: Rapprochement | undefined;
          try {
            r = await chercher(m);
          } catch (error) {
            logger.warn({ acteurUid: m.acteurUid, error: errorMessage(error) }, 'Wikidata : recherche ratée');
          }
          if (r === undefined) {
            rapport.erreurs++;
            qid.set(m.id, m.wikidataId ?? undefined);
            return;
          }
          if (r.qid !== null) {
            if (r.qid !== m.wikidataId) rapport.rapproches++;
            journal(`${m.prenom} ${m.nom} → ${r.qid} (${r.preuves.join(', ')})`);
          } else {
            if (r.motif === 'ambigu') rapport.ambigus++;
            journal(`${m.prenom} ${m.nom} : ${r.motif === 'ambigu' ? `ambigu (${r.candidats.join(', ')})` : 'aucun candidat sûr'}`);
          }
          qid.set(m.id, r.qid);
        }),
      ),
  );

  // 2) Image principale des personnes retenues dont la photo n'est pas figée.
  //    Une entité fusionnée renvoie vers la nouvelle (on suit l'identifiant),
  //    une entité supprimée est oubliée.
  const aLire = membres.filter((m) => !figee(m));
  const ids = [...new Set(aLire.map((m) => qid.get(m.id)).filter((q): q is string => !!q))];
  let entites: Map<string, WbEntite> | null = null;
  try {
    entites = ids.length > 0 ? await chargerEntites(ids, 'claims') : new Map();
  } catch (error) {
    rapport.erreurs++;
    logger.warn({ error: errorMessage(error) }, 'Wikidata : images non lues, photos laissées telles quelles');
  }

  const fichier = new Map<string, string | null>();
  if (entites) {
    for (const m of aLire) {
      const q = qid.get(m.id);
      if (!q) continue;
      const e = entites.get(q);
      if (!e) continue; // absente de la réponse : on ne sait pas
      if (e.missing !== undefined) {
        qid.set(m.id, null);
        continue;
      }
      if (e.id && e.id !== q) qid.set(m.id, e.id);
      fichier.set(m.id, imagePrincipale(e));
    }
  }

  // 3) Vignettes et crédits sur Commons : les images à adopter, et les fichiers
  //    des photos figées, dont on vérifie seulement qu'ils existent encore.
  const fichierFige = new Map(membres.filter(figee).map((m) => [m.id, fichierDepuisPage(m.photoSource)]));
  let images: ImagesCommons | null = null;
  const fichiers = [...fichier.values(), ...fichierFige.values()].filter((f): f is string => !!f);
  try {
    images = fichiers.length > 0 ? await lireImagesCommons(fichiers) : new Map();
  } catch (error) {
    rapport.erreurs++;
    logger.warn({ error: errorMessage(error) }, 'Commons : crédits non lus, photos laissées telles quelles');
  }

  // 4) Écriture par différence.
  for (const m of membres) {
    const q = qid.get(m.id);
    const actuelles: ValeursPhoto = {
      photoUrl: m.photoUrl, photoAuteur: m.photoAuteur, photoLicence: m.photoLicence,
      photoLicenceUrl: m.photoLicenceUrl, photoSource: m.photoSource,
    };
    let cible: ValeursPhoto = actuelles;

    if (figee(m)) {
      const f = fichierFige.get(m.id);
      if (f && images?.has(f) && images.get(f) === null) {
        rapport.fichiersSupprimes++;
        journal(`${m.prenom} ${m.nom} : fichier supprimé de Commons, photo retirée`);
        cible = SANS_PHOTO;
      } else {
        rapport.figees++;
      }
    } else if (q === null) {
      rapport.sansRapprochement++;
      cible = SANS_PHOTO;
    } else if (q !== undefined && entites && fichier.has(m.id)) {
      const f = fichier.get(m.id)!;
      if (f === null) {
        rapport.sansImage++;
        cible = SANS_PHOTO;
      } else if (images?.has(f)) {
        const image = images.get(f)!;
        if (image === null) {
          cible = SANS_PHOTO; // fichier supprimé de Commons
        } else if (!creditValide(image)) {
          rapport.creditsRefuses++;
          journal(`${m.prenom} ${m.nom} : photo écartée (licence « ${image.licence ?? '?'} », auteur ${image.auteur ?? 'inconnu'})`);
          cible = SANS_PHOTO;
        } else if (image.page === m.photoSource) {
          cible = valeursDepuisImage(image); // même fichier : crédit relu (--actualiser)
        } else {
          // Nouvelle image : seulement si elle était déjà là il y a 7 jours.
          const ancienne = await imageIlYA(q, new Date(maintenant.getTime() - DELAI_STABILITE_JOURS * JOUR_MS));
          if (ancienne === undefined) {
            rapport.erreurs++;
          } else if (ancienne !== f) {
            rapport.adoptionsDifferees++;
            journal(`${m.prenom} ${m.nom} : image différente il y a ${DELAI_STABILITE_JOURS} jours, photo différée`);
          } else {
            cible = valeursDepuisImage(image);
          }
        }
      }
    }

    const nouveauQid = q === undefined ? m.wikidataId : q;
    const change =
      nouveauQid !== m.wikidataId ||
      (Object.keys(cible) as Array<keyof ValeursPhoto>).some((k) => cible[k] !== actuelles[k]);
    if (cible.photoUrl) rapport.avecPhoto++;
    if (!change) continue;
    rapport.modifies++;
    if (options.dryRun) continue;
    try {
      await prisma.membreGouvernement.update({ where: { id: m.id }, data: { wikidataId: nouveauQid, ...cible } });
    } catch (error) {
      rapport.erreurs++;
      logger.warn({ acteurUid: m.acteurUid, error: errorMessage(error) }, 'Photo de membre non écrite');
    }
  }

  logger.info(rapport, `Photos des membres du Gouvernement sans fiche${options.dryRun ? ' (essai)' : ''}`);
  return rapport;
}
