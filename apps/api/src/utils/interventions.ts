// =============================================================================
// Ce qu'on appelle « une intervention » quand on la montre ou qu'on la compte
// =============================================================================

/**
 * Type réservé aux interruptions de séance.
 *
 * Le compte rendu de l'Assemblée publie les interruptions comme des
 * paragraphes nominatifs — « Quel scandale ! », « Mais oui, bien sûr ! », une
 * quarantaine de caractères en moyenne. Elles pèsent un cinquième du corpus.
 */
export const TYPE_INTERRUPTION = 'interruption';

/**
 * Réponse d'un membre du Gouvernement à une question parlementaire.
 *
 * Questions et réponses partagent la même rubrique au compte rendu ; les
 * distinguer évite qu'un ministre qui répond voie sa réponse comptée comme une
 * question qu'il aurait posée. C'est une prise de parole de fond : elle
 * s'affiche et se compte comme les autres, seul le compteur de questions
 * posées l'écarte.
 */
export const TYPE_REPONSE = 'reponse_gouvernement';

/**
 * Le filtre des interventions de fond : ce qu'un lecteur attend quand il
 * demande « les interventions » d'un parlementaire ou d'une séance.
 *
 * Deux choses en sont écartées, pour deux raisons différentes :
 *
 * - `estPresidence` — la mécanique de séance (« La parole est à M. X »,
 *   « Je mets aux voix… »). Ce n'est pas une prise de position, c'est de la
 *   plomberie ; on l'ingère parce qu'elle porte la segmentation du débat.
 * - `type: interruption` — le chahut. Ce sont de vraies prises de parole,
 *   attribuées à leur auteur, et on les garde : elles se lisent à part. Mais
 *   les mêler aux interventions de fond gonflerait l'activité d'un député de
 *   plusieurs milliers de lignes qui ne disent rien de son travail.
 *
 * - `reunionId: null` — la séance publique seulement. Les prises de parole en
 *   réunion de commission vivent dans la même table, avec leur réunion en
 *   référence. Les faire entrer dans ce filtre changerait d'un coup le chiffre
 *   « interventions » affiché sur 577 fiches de députés, sur la page d'accueil
 *   et dans les analytics : c'est une décision éditoriale à prendre, pas une
 *   conséquence de l'ingestion. Le jour où elle est prise, ce filtre est le
 *   seul endroit à modifier — c'est pourquoi la borne est ici plutôt que
 *   répétée sur les cinq sites qui comptent.
 *
 * Les trois restent en base et interrogeables ; ce filtre ne décide que de ce
 * qui est montré et compté par défaut.
 */
export const INTERVENTIONS_DE_FOND = {
  estPresidence: false,
  type: { not: TYPE_INTERRUPTION },
  reunionId: null,
} as const;

/**
 * Fenêtre correspondant à la journée de séance d'une date donnée.
 *
 * Les scrutins sont datés à minuit, les interventions à l'heure d'ouverture de
 * la séance dont elles relèvent — 9 h, 15 h, 21 h 30. Comparer les deux par
 * égalité stricte ne rapproche donc jamais rien côté Assemblée : il faut
 * cadrer sur la journée. L'heure de séance est une information réelle, qui
 * distingue les séances du matin, de l'après-midi et du soir ; on l'interroge
 * par intervalle plutôt que de l'écraser à minuit.
 */
export function journeeDeSeance(date: Date): { gte: Date; lt: Date } {
  const debut = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const lendemain = new Date(debut);
  lendemain.setUTCDate(lendemain.getUTCDate() + 1);
  return { gte: debut, lt: lendemain };
}

/**
 * L'identifiant sous lequel le Sénat range un jour de séance : `d20260721`.
 *
 * Le Sénat publie ses comptes rendus par jour et ne nomme la séance sur aucun
 * de ses scrutins : cette journée est le seul nom commun aux prises de parole,
 * aux réunions de l'agenda et aux votes. Les deux colonnes dont on la tire
 * portent la date de Paris dans leur partie UTC — l'ouverture de séance en
 * heure de Paris, le scrutin à minuit pile — d'où la lecture sans conversion.
 */
export function jourDeSeanceSenat(date: Date): string {
  return `d${date.toISOString().slice(0, 10).replace(/-/gu, '')}`;
}

// =============================================================================
// Les annonces d'ordre du jour
// =============================================================================

/**
 * L'ouverture exacte d'une annonce d'ordre du jour, apostrophe typographique
 * comprise.
 *
 * Mesuré sur la base : 4 265 prises de parole commencent ainsi, et les cinq
 * autres lignes où l'expression apparaît n'en sont pas — elle y est citée au
 * fil d'une phrase. Le préfixe suffit donc à les désigner, sans recherche en
 * sous-chaîne.
 */
export const ANNONCE_ORDRE_DU_JOUR = 'L’ordre du jour appelle';

/** Le numéro de dépôt dont l'annonce se termine : « (no 3004). », « (nos 12, 15) ». */
const NUMERO_EN_FIN = /\s*\(n[o°s]+[^)]*\)\s*\.?\s*$/u;

/**
 * Le titre à afficher pour une annonce d'ordre du jour.
 *
 * CE QUE CES ANNONCES APPORTENT. La présidence ouvre chaque point de la
 * journée en le nommant : « L'ordre du jour appelle la discussion, sur le
 * rapport de la commission mixte paritaire, de la proposition de loi visant à
 * moderniser la gestion du patrimoine immobilier de l'État. » Le filtre des
 * prises de fond les écarte — à raison pour les compteurs, c'est de la
 * mécanique de séance — mais elles portent l'ÉTAPE de lecture du texte, que le
 * lien vers le dossier ne dit pas.
 *
 * ON GARDE LES MOTS DE LA SÉANCE. Pas de reformulation : l'annonce est ce que
 * la présidence a prononcé. Deux choses seulement sont retirées — la phrase
 * suivante, quand l'annonce en compte plusieurs (« La parole est à… », qui
 * n'appartient plus au titre), et le numéro de dépôt final, que la page
 * affiche déjà comme lien vers le dossier.
 */
export function titreDOrdreDuJour(contenu: string): string {
  const propre = contenu.replace(/\s+/gu, ' ').trim();

  const fin = finDeLaPremierePhrase(propre);
  const phrase = fin === -1 ? propre : propre.slice(0, fin);

  return phrase.replace(NUMERO_EN_FIN, '').replace(/\s*[.,;]\s*$/u, '').trim();
}

/**
 * Abréviations dont le point ne termine pas une phrase.
 *
 * Sans elles, « la proposition de loi de M. Dupont visant à… » se couperait
 * net après « de M. ».
 */
const ABREVIATIONS = new Set(['M', 'MM', 'Mme', 'Mmes', 'no', 'nos', 'art', 'al', 'cf']);

/**
 * L'indice du point qui clôt la première phrase, ou -1.
 *
 * Le compte rendu colle souvent les phrases — « (nos 235, 273). Ce matin,
 * l'Assemblée a poursuivi… » s'écrit aussi bien sans l'espace. On accepte donc
 * un point suivi d'une majuscule avec ou sans blanc, et on écarte les
 * abréviations qui en portent un.
 */
function finDeLaPremierePhrase(texte: string): number {
  const separateur = /\.\s*(?=[A-ZÀ-Þ«])/gu;
  let m: RegExpExecArray | null;

  while ((m = separateur.exec(texte)) !== null) {
    const avant = /([\p{L}]+)$/u.exec(texte.slice(0, m.index));
    if (avant && ABREVIATIONS.has(avant[1]!)) continue;
    return m.index;
  }
  return -1;
}
