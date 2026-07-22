/**
 * Construction des URLs vers les pages de détail de scrutin.
 *
 * Un numéro de scrutin n'est unique dans AUCUNE des deux chambres :
 *  - au Sénat, il est réinitialisé à chaque session parlementaire ;
 *  - à l'Assemblée, il est réinitialisé à chaque législature (le n°4000 existe
 *    en 15e, 16e ET 17e).
 *
 * La clé unique réelle est `(numero, chambre, session)` (cf.
 * `@@unique([numero, chambre, session])` dans le schéma Prisma), où `session`
 * porte la session au Sénat et le numéro de législature à l'Assemblée.
 *
 * Tout lien vers un scrutin DOIT donc transporter `chambre` ET `session`, sinon
 * l'API résout vers un scrutin arbitraire (bug feedback : scrutin Sénat n°54 →
 * scrutin AN n°54).
 *
 * Ce module est l'unique source de vérité pour ces URLs : l'utiliser partout
 * plutôt que de reconstruire la query string à la main.
 */
export interface ScrutinLinkRef {
  numero: number | string;
  chambre?: string | null;
  session?: string | null;
}

/**
 * Query string (sans le `?` initial) identifiant un scrutin de façon non ambiguë :
 * `chambre=…` et `session=…`, dans les deux chambres.
 */
export function scrutinQuery({
  chambre,
  session,
}: Pick<ScrutinLinkRef, 'chambre' | 'session'>): string {
  const ch = chambre || 'assemblee';
  const params = new URLSearchParams({ chambre: ch });
  if (session) {
    params.set('session', session);
  }
  return params.toString();
}

/** URL relative vers la page de détail d'un scrutin. */
export function scrutinHref(scrutin: ScrutinLinkRef): string {
  return `/scrutins/${scrutin.numero}?${scrutinQuery(scrutin)}`;
}
