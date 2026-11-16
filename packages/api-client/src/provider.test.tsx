import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { type ApiClient, ApiError, createFixtureClient } from "./client.ts";
import { ApiProvider, createQueryClient, useApiClient, useApiQuery } from "./provider.tsx";

const avec =
  (client: ApiClient, queryClient = createQueryClient()) =>
  ({ children }: { children: ReactNode }) => (
    <ApiProvider client={client} queryClient={queryClient}>
      {children}
    </ApiProvider>
  );

describe("createQueryClient", () => {
  const retry = createQueryClient().getDefaultOptions().queries?.retry as (
    n: number,
    e: unknown,
  ) => boolean;

  it("ne réessaie jamais une ressource introuvable (404)", () => {
    expect(retry(0, new ApiError(404, "/x"))).toBe(false);
  });

  it("réessaie une seule fois une autre erreur", () => {
    expect(retry(0, new ApiError(500, "/x"))).toBe(true);
    expect(retry(1, new ApiError(500, "/x"))).toBe(false);
    expect(retry(0, new Error("réseau"))).toBe(true);
  });
});

describe("useApiClient", () => {
  it("refuse de tourner sans ApiProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useApiClient())).toThrow("ApiProvider manquant");
  });
});

describe("useApiQuery", () => {
  it("lit le chemin avec ses paramètres", async () => {
    const client = createFixtureClient({ "/scrutins": { total: 3 } });
    const get = vi.spyOn(client, "get");
    const { result } = renderHook(() => useApiQuery("/scrutins", { page: 2 }), {
      wrapper: avec(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ total: 3 });
    expect(get).toHaveBeenCalledWith("/scrutins", { page: 2 });
  });

  it("reprend les données du serveur sans nouvel appel", () => {
    const get = vi.fn();
    const { result } = renderHook(() => useApiQuery("/a", {}, { initialData: { x: 1 } }), {
      wrapper: avec({ get }),
    });
    expect(result.current.data).toEqual({ x: 1 });
    expect(get).not.toHaveBeenCalled();
  });

  it("n'appelle rien tant que la requête est désactivée", () => {
    const get = vi.fn();
    const { result } = renderHook(() => useApiQuery("/a", {}, { enabled: false }), {
      wrapper: avec({ get }),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(get).not.toHaveBeenCalled();
  });

  it("remonte une 404 sans nouvelle tentative", async () => {
    const client = createFixtureClient({});
    const get = vi.spyOn(client, "get");
    const { result } = renderHook(() => useApiQuery("/inconnu"), { wrapper: avec(client) });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 404 });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("relit la donnée à intervalle régulier (direct de l'agenda)", async () => {
    let n = 0;
    const client = createFixtureClient({ "/agenda/direct": () => ({ n: ++n }) });
    const get = vi.spyOn(client, "get");
    const { result } = renderHook(
      () => useApiQuery<{ n: number }>("/agenda/direct", {}, { refetchInterval: 20 }),
      {
        wrapper: avec(client),
      },
    );
    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThanOrEqual(3));
    expect(result.current.data?.n ?? 0).toBeGreaterThanOrEqual(2);
  });
});
