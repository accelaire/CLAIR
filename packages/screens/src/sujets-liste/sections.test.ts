import { describe, expect, it } from "vitest";
import { sujetEnCours, sujetPromulgue, sujetRejete } from "./fixtures.ts";
import { sectionsDe } from "./sections.ts";

const maintenant = new Date("2026-10-26T12:00:00.000Z").getTime();
const actif = { ...sujetEnCours, dateDernierVote: "2026-10-20T00:00:00.000Z" };

describe("sections de la liste des sujets", () => {
  it("met à la une un sujet en discussion voté récemment, et le retire de sa section", () => {
    const sections = sectionsDe([actif, sujetPromulgue], { recherche: false, maintenant });
    expect(sections.aLaUne?.id).toBe(actif.id);
    expect(sections.enDiscussion).toEqual([]);
    expect(sections.recemmentPromulgues.map((s) => s.id)).toEqual([sujetPromulgue.id]);
  });

  it("ne met rien en avant pendant une recherche", () => {
    const sections = sectionsDe([actif, sujetPromulgue], { recherche: true, maintenant });
    expect(sections.aLaUne).toBeNull();
    expect(sections.recemmentPromulgues).toEqual([]);
    expect(sections.enDiscussion).toHaveLength(1);
    expect(sections.promulgues).toHaveLength(1);
  });

  it("range rejetés, caducs et retirés à part", () => {
    const caduc = { ...sujetEnCours, id: "caduc", status: "caduc" };
    const sections = sectionsDe([sujetRejete, caduc], { recherche: false, maintenant });
    expect(sections.rejetes.map((s) => s.id)).toEqual([sujetRejete.id]);
    expect(sections.autres.map((s) => s.id)).toEqual(["caduc"]);
  });
});
