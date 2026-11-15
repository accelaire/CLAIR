// =============================================================================
// Photos des anciens sénateurs (senat.fr)
//
// L'annuaire du Sénat (`senateurs.json`) ne donne l'avatar que des sénateurs en
// exercice ; les anciens créés depuis l'open data ODSEN (`senat-histo.ts`)
// n'avaient donc pas de photo : 619 fiches sur 692 le 15/11/2026, dont
// 24 membres du Gouvernement (#136).
//
// Le Sénat publie pourtant la photo de chacun, ancien compris, à une adresse
// construite sur le nom, le prénom et le matricule :
// `https://www.senat.fr/senimg/{nom}_{prenom}{matricule}_carre.jpg`. La règle
// redonne à l'identique les 421 adresses déjà en base (348 en exercice et 73
// anciens), particules, apostrophes et trémas compris.
//
// L'adresse n'est écrite qu'après une réponse 200 de type image : sans photo,
// senat.fr répond 404 (et sa page montre une silhouette). Le matricule fait
// partie de l'adresse, si bien qu'une réponse positive ne peut être que la
// photo de cette personne. Seules les fiches sans photo sont visées : une
// adresse déjà en base, celle de l'annuaire en particulier, n'est jamais
// remplacée.
// =============================================================================

import type { PrismaClient } from '@prisma/client';
import pLimit from 'p-limit';
import { logger } from '../utils/logger';
import { errorMessage } from '../utils/errors';

const SENIMG = 'https://www.senat.fr/senimg';
const USER_AGENT = 'CLAIR/1.0 (+https://clair.vote)';
const TIMEOUT_MS = 20_000;
/** Requêtes simultanées vers senat.fr : un rattrapage complet en fait ~600. */
const CONCURRENCE = 4;

/**
 * Forme d'un nom dans les adresses de senat.fr : sans accents, en minuscules,
 * chaque suite d'autres caractères devenue un tiret bas.
 * « de La Provôté » → « de_la_provote », « d'Aigremont » → « d_aigremont ».
 */
export function nomTechniqueSenat(valeur: string): string {
  return valeur
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Adresse de la photo d'un sénateur sur senat.fr, à vérifier avant usage. */
export function urlPhotoSenat(nom: string, prenom: string, matricule: string): string {
  return `${SENIMG}/${nomTechniqueSenat(nom)}_${nomTechniqueSenat(prenom)}${matricule.toLowerCase()}_carre.jpg`;
}

/** Réponse de senat.fr pour une adresse de photo. */
export type VerdictPhoto = 'image' | 'absente' | 'erreur';

/** HEAD sur l'adresse : `image` seulement pour un 200 de type image. */
export async function verifierPhoto(url: string): Promise<VerdictPhoto> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual',
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    if (res.status === 200 && (res.headers.get('content-type') ?? '').startsWith('image/')) return 'image';
    // 404 : pas de photo publiée. Tout le reste (redirection, 5xx, 200 en HTML)
    // est un doute : rien n'est écrit, la fiche sera retentée au prochain passage.
    return res.status === 404 ? 'absente' : 'erreur';
  } catch {
    return 'erreur';
  } finally {
    clearTimeout(timer);
  }
}

export interface ResultatPhotosSenat {
  /** Fiches du Sénat sans photo examinées */
  candidates: number;
  /** Photos trouvées et écrites */
  renseignees: number;
  /** senat.fr ne publie pas de photo (404) */
  absentes: number;
  /** Réponse inattendue ou réseau : rien d'écrit, retenté au prochain passage */
  erreurs: number;
}

/**
 * Renseigne `photo_url` des fiches du Sénat qui n'en ont pas, depuis senat.fr.
 * Idempotent : une fiche pourvue n'est plus examinée.
 */
export async function completerPhotosSenateurs(
  prisma: PrismaClient,
  options: { verifier?: (url: string) => Promise<VerdictPhoto> } = {},
): Promise<ResultatPhotosSenat> {
  const verifier = options.verifier ?? verifierPhoto;
  const fiches = await prisma.parlementaire.findMany({
    where: { chambre: 'senat', photoUrl: null, sourceId: { not: null } },
    select: { id: true, nom: true, prenom: true, sourceId: true },
    orderBy: { sourceId: 'asc' },
  });

  const resultat: ResultatPhotosSenat = { candidates: fiches.length, renseignees: 0, absentes: 0, erreurs: 0 };
  const limite = pLimit(CONCURRENCE);

  await Promise.all(
    fiches.map((fiche) =>
      limite(async () => {
        const url = urlPhotoSenat(fiche.nom, fiche.prenom, fiche.sourceId!);
        const verdict = await verifier(url);
        if (verdict === 'absente') {
          resultat.absentes++;
          return;
        }
        if (verdict === 'erreur') {
          resultat.erreurs++;
          logger.warn({ matricule: fiche.sourceId, url }, 'Photo du Sénat non vérifiable, fiche laissée sans photo');
          return;
        }
        try {
          // `photoUrl: null` dans le filtre : la synchro de l'annuaire a pu
          // écrire l'avatar entre-temps, il garde la main.
          const { count } = await prisma.parlementaire.updateMany({
            where: { id: fiche.id, photoUrl: null },
            data: { photoUrl: url },
          });
          resultat.renseignees += count;
        } catch (error) {
          resultat.erreurs++;
          logger.warn({ matricule: fiche.sourceId, error: errorMessage(error) }, 'Photo du Sénat non écrite');
        }
      }),
    ),
  );

  if (resultat.erreurs > 0) {
    logger.warn(resultat, 'Photos des anciens sénateurs : des adresses restent à vérifier');
  } else {
    logger.info(resultat, 'Photos des anciens sénateurs');
  }
  return resultat;
}
