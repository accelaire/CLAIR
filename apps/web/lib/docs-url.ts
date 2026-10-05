/**
 * Adresses de la documentation technique (workspace `docs/`, servi sur
 * docs.clair.vote) et de l'API publique, telles qu'on les montre aux lecteurs.
 *
 * `PUBLIC_API_URL` n'est pas `NEXT_PUBLIC_API_URL` : celle-ci est l'adresse
 * technique que le site appelle (l'URL Railway en prod), pas celle à publier.
 */
export const DOCS_URL = 'https://docs.clair.vote';
export const PUBLIC_API_URL = 'https://api.clair.vote';

// Les chemins de la doc suivent ses dossiers : s'ils changent, ajouter une
// redirection côté doc (`docsRedirects`) plutôt que de casser ce lien.
export const CONTRIBUTION_GUIDE_URL = `${DOCS_URL}/01-guide/guide-developpeur/contribution`;
