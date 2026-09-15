/**
 * Version du rendu de la carte OG des scrutins, reportée en query string dans
 * `og:image`.
 *
 * Les consommateurs (Twitter, Slack, navigateurs) mettent la carte en cache par
 * URL. Corriger le rendu ne suffit donc pas : tant que l'URL ne change pas, ils
 * resservent l'image qu'ils détiennent. Incrémenter cette version est le seul
 * moyen de forcer un refetch en masse — le validateur de Twitter se fait URL
 * par URL, ce qui est hors de portée sur 21 731 scrutins.
 *
 * À incrémenter quand le rendu change d'une façon qui rend FAUSSE l'image déjà
 * diffusée, pas à chaque retouche esthétique : chaque incrément invalide tout
 * le corpus.
 *
 * v2 : les scrutins adoptés s'annonçaient « Rejeté » (cf. lib/scrutin-sort.ts).
 *
 * Module dédié et sans dépendance : la page et le route handler le partagent,
 * et la page ne doit pas tirer `next/og` dans son bundle pour une constante.
 */
export const OG_CARD_VERSION = '2';
