/**
 * Ce qu'une circonscription de la série 2 permet d'écrire.
 *
 * Partagé entre la page `/senatoriales-2026/[departement]`, ses métadonnées et
 * son aperçu Open Graph : les trois décrivent la même circonscription et doivent
 * en dire la même chose. Le mode de scrutin, en particulier, se déduit du seul
 * nombre de sièges (article L. 295 du code électoral) ; le recopier dans la
 * route d'image serait l'occasion parfaite de le voir dériver de la page.
 */

import { fetchFromApi } from '@/lib/api-server';
import type { ApercuSenatoriales } from '@/app/senatoriales-2026/PageClient';
import { codeDepuisSlug } from './departements';

type CirconscriptionApercu = ApercuSenatoriales['circonscriptions'][number];

/** Une circonscription telle que l'aperçu la décrit, nom nettoyé et code résolu. */
export type Circonscription = CirconscriptionApercu & { code: string };

/**
 * Libellé d'affichage : « Français établis hors de France (Série 2) » se passe
 * de son rappel de série dans un titre qui annonce déjà les sénatoriales 2026.
 */
export function libelleCirconscription(nom: string): string {
  return nom.replace(/\s*\(Série \d+\)\s*$/, '').trim();
}

/**
 * Accord d'un nom sur une circonscription à un seul siège — vingt-deux des
 * soixante-quatre n'en renouvellent qu'un.
 */
export function pluriel(n: number, mot: string): string {
  return n > 1 ? `${mot}s` : mot;
}

/** Accord d'un verbe. Séparé de `pluriel`, qui donnerait « ests » et « sonts ». */
export function accorde(n: number, singulier: string, plurielVerbe: string): string {
  return n > 1 ? plurielVerbe : singulier;
}

/**
 * Mode de scrutin applicable à une circonscription.
 *
 * La règle tient au nombre de sièges à pourvoir, et à lui seul : c'est l'article
 * L. 295 du code électoral. Elle est rappelée sur la page mère pour l'ensemble
 * du scrutin ; ici on l'applique, ce qui donne à chacune des 64 pages une phrase
 * qui n'est vraie que pour elle.
 */
export function modeDeScrutin(nbSieges: number) {
  return nbSieges >= 3
    ? {
        court: 'proportionnel de liste à un tour',
        /** Deux mots, pour une pastille d'image OG. */
        bref: 'proportionnel',
        /** Ce qu'une candidature est ici : une liste bloquée. */
        unite: 'liste',
        phrase:
          'Les sièges sont pourvus au scrutin proportionnel de liste à un tour, à la plus forte moyenne. Les électeurs votent pour une liste bloquée, sans panachage ni vote préférentiel.',
      }
    : {
        court: 'majoritaire à deux tours',
        bref: 'majoritaire',
        unite: 'candidature',
        phrase:
          'Les sièges sont pourvus au scrutin majoritaire à deux tours. Est élu au premier tour le candidat qui réunit la majorité absolue des suffrages exprimés et le quart des électeurs inscrits ; au second tour, la majorité relative suffit.',
      };
}

/**
 * Circonscription désignée par un segment d'URL, ou `null` s'il n'en désigne
 * aucune — ou si l'API ne répond pas.
 *
 * Les appelants traitent ces deux cas différemment : la page rend un `notFound()`,
 * l'image OG se replie sur une carte sans chiffres. C'est pourquoi la distinction
 * se fait chez eux et non ici : le slug, lui, est validé hors réseau.
 */
export async function circonscriptionDepuisSlug(
  slug: string,
): Promise<Circonscription | null> {
  const code = codeDepuisSlug(slug);
  if (!code) return null;

  const apercu = await fetchFromApi<ApercuSenatoriales>('/senatoriales/2026', 3600);
  const trouvee = apercu?.circonscriptions?.find((c) => c.departement === code);
  return trouvee ? { ...trouvee, code, nom: libelleCirconscription(trouvee.nom) } : null;
}
