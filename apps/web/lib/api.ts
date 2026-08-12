import axios from 'axios';

// Same-origin, via le proxy `app/api/v1/[...path]/route.ts`.
//
// Le navigateur n'appelle plus l'API en direct. Il ne peut porter aucun secret —
// tout ce qu'il envoie est reproductible par n'importe quel client HTTP — donc
// tant qu'il s'adressait à api.clair.vote, la seule façon de lui accorder un
// quota confortable était de faire confiance à son en-tête `Origin`, que
// n'importe qui pouvait copier. Le détour par le proxy déplace cette
// authentification vers un serveur, qui lui peut détenir le secret.
//
// Effet de bord bienvenu : plus aucun CORS en jeu pour l'application.
export const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});


// Types pour les réponses API
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiError {
  error: string;
  code: string;
  message: string;
  details?: unknown;
}

// Helpers
export async function fetcher<T>(url: string): Promise<T> {
  const response = await api.get<T>(url);
  return response.data;
}
