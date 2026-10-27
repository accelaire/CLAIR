import { describe, expect, it, vi } from "vitest";
import {
  ApiError,
  createFixtureClient,
  createHttpClient,
  type Query,
  withQuery,
} from "./client.ts";

describe("withQuery", () => {
  it("omet les valeurs vides et répète les listes", () => {
    expect(withQuery("/deputes", { page: 2, groupe: ["RN", "LFI"], q: "", actifs: false })).toBe(
      "/deputes?page=2&groupe=RN&groupe=LFI",
    );
  });
});

describe("createHttpClient", () => {
  it("appelle la base avec les en-têtes et renvoie le JSON", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const client = createHttpClient({ baseUrl: "/api/v1", headers: { "x-test": "1" }, fetch });
    await expect(client.get("/scrutins", { page: 1 })).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/scrutins?page=1",
      expect.objectContaining({
        headers: expect.objectContaining({ "x-test": "1" }),
      }),
    );
  });

  it("transforme une réponse 404 en ApiError", async () => {
    const fetch = vi.fn(async () => new Response("", { status: 404 }));
    const client = createHttpClient({ baseUrl: "/api/v1", fetch });
    await expect(client.get("/deputes/inconnu")).rejects.toMatchObject({ status: 404 });
  });
});

describe("createFixtureClient", () => {
  it("répond depuis les fixtures, 404 sinon", async () => {
    const client = createFixtureClient({ "/a": { x: 1 }, "/b": (q: Query) => ({ page: q.page }) });
    await expect(client.get("/a")).resolves.toEqual({ x: 1 });
    await expect(client.get("/b", { page: 3 })).resolves.toEqual({ page: 3 });
    await expect(client.get("/c")).rejects.toBeInstanceOf(ApiError);
  });
});
