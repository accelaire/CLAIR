import { describe, expect, it } from "vitest";
import { pageOf } from "./common.ts";

describe("pageOf", () => {
  it("lit la pagination « meta »", () => {
    const page = pageOf({ data: [1, 2], meta: { total: 12, page: 2, limit: 2, totalPages: 6 } });
    expect(page).toEqual({ items: [1, 2], total: 12, page: 2, totalPages: 6 });
  });

  it("lit la pagination « pagination »", () => {
    const page = pageOf({
      data: ["a"],
      pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
    });
    expect(page).toEqual({ items: ["a"], total: 1, page: 1, totalPages: 1 });
  });
});
