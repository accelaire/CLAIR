"use client";

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useState } from "react";
import { type ApiClient, ApiError, type Query } from "./client.ts";

const ApiContext = createContext<ApiClient | null>(null);

/** Réglages des requêtes : données fraîches une minute, une seule nouvelle tentative, pas sur 404. */
export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status === 404) && failureCount < 1,
      },
    },
  });

/** Fournit le client d'API et le cache de requêtes à l'application. */
export const ApiProvider = ({
  client,
  queryClient,
  children,
}: {
  client: ApiClient;
  queryClient?: QueryClient;
  children: ReactNode;
}) => {
  const [cache] = useState(() => queryClient ?? createQueryClient());
  return (
    <ApiContext.Provider value={client}>
      <QueryClientProvider client={cache}>{children}</QueryClientProvider>
    </ApiContext.Provider>
  );
};

export const useApiClient = () => {
  const client = useContext(ApiContext);
  if (!client) throw new Error("useApiClient : ApiProvider manquant");
  return client;
};

/**
 * Requête GET mise en cache. `initialData` : données chargées par la route côté serveur
 * (rendu et référencement), reprises sans nouvel appel.
 */
export const useApiQuery = <T,>(
  path: string,
  query: Query = {},
  { initialData, enabled = true }: { initialData?: T; enabled?: boolean } = {},
) => {
  const client = useApiClient();
  return useQuery<T>({
    queryKey: ["clair", path, query],
    queryFn: () => client.get<T>(path, query),
    initialData,
    enabled,
  });
};
