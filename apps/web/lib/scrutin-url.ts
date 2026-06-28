/**
 * Construction des URLs vers les pages de détail de scrutin.
 *
 * Au Sénat, le numéro de scrutin n'est PAS unique : il est réinitialisé à chaque
 * session parlementaire. La clé unique réelle est `(numero, chambre, session)`
 * (cf. `@@unique([numero, chambre, session])` dans le schéma Prisma).
 *
 * Tout lien vers un scrutin du Sénat DOIT donc transporter `chambre` ET `session`,
 * sinon l'API résout vers un scrutin arbitraire — par défaut celui de l'Assemblée
 * nationale, qui partage le même numéro (bug feedback : scrutin Sénat n°54 →
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
 * Query string (sans le `?` initial) identifiant un scrutin de façon non ambiguë.
 * Toujours `chambre=…`, plus `session=…` quand il s'agit du Sénat.
 */
export function scrutinQuery({
  chambre,
  session,
}: Pick<ScrutinLinkRef, 'chambre' | 'session'>): string {
  const ch = chambre || 'assemblee';
  const params = new URLSearchParams({ chambre: ch });
  if (ch === 'senat' && session) {
    params.set('session', session);
  }
  return params.toString();
}

/** URL relative vers la page de détail d'un scrutin. */
export function scrutinHref(scrutin: ScrutinLinkRef): string {
  return `/scrutins/${scrutin.numero}?${scrutinQuery(scrutin)}`;
}
