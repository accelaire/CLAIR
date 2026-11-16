import { describe, expect, it } from "vitest";
import { ongletDeLAncre } from "./onglet-ancre.ts";

const ONGLETS = ["amendements", "debats", "vote"] as const;

describe("ongletDeLAncre", () => {
  it("reconnaît une ancre qui nomme un onglet, avec ou sans dièse", () => {
    expect(ongletDeLAncre("#vote", ONGLETS)).toBe("vote");
    expect(ongletDeLAncre("debats", ONGLETS)).toBe("debats");
    expect(ongletDeLAncre("#d%C3%A9bats", ["débats"])).toBe("débats");
  });

  it("laisse au navigateur une autre ancre, ou une ancre mal encodée", () => {
    expect(ongletDeLAncre("", ONGLETS)).toBeNull();
    expect(ongletDeLAncre("#prise-12", ONGLETS)).toBeNull();
    expect(ongletDeLAncre("#%E0%A4%A", ONGLETS)).toBeNull();
  });
});
