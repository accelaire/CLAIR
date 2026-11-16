import { describe, expect, it } from "vitest";
import {
  construirePlanDuSite,
  DONNEES_PLAN_VIDES,
  type DonneesPlan,
  derniereIngestion,
  type EntreePlan,
} from "./sitemap.ts";

const BASE = "https://clair.vote";
const MAINTENANT = "2026-10-27T04:00:00.000Z";

const plan = (data: Partial<DonneesPlan>) =>
  construirePlanDuSite({
    base: BASE,
    data: { ...DONNEES_PLAN_VIDES, ...data },
    groupes: [{ slug: "sans-date", chambre: "senat" }],
    elusProvisoires: [],
    maintenant: MAINTENANT,
  });

const entree = (entrees: EntreePlan[], url: string) => entrees.find((e) => e.url === url);

describe("derniereIngestion", () => {
  it("prend la date la plus récente, et le repli sans date", () => {
    expect(
      derniereIngestion(
        {
          ...DONNEES_PLAN_VIDES,
          deputes: [{ slug: "a", updatedAt: "2026-01-01" }],
          senateurs: [{ slug: "b", updatedAt: "2026-02-01" }],
          sujets: [{ slug: "c", updatedAt: "" }],
          lobbyistes: [{ id: "d" }],
        },
        MAINTENANT,
      ),
    ).toBe("2026-02-01");
    expect(derniereIngestion(DONNEES_PLAN_VIDES, MAINTENANT)).toBe(MAINTENANT);
  });
});

describe("construirePlanDuSite, cas limites", () => {
  it("ignore les scrutins sans date exploitable et date chaque archive par son dernier scrutin", () => {
    const entrees = plan({
      scrutins: [
        { numero: 1, chambre: "assemblee", session: null, date: "2025-03-02" },
        { numero: 2, chambre: "assemblee", session: null, date: "2025-03-20" },
        { numero: 3, chambre: "assemblee", session: null, date: "2025-01-05" },
        { numero: 4, chambre: "assemblee", session: null, date: "inconnue" },
      ],
    });
    expect(entree(entrees, `${BASE}/votes/2025`)?.lastModified).toBe("2025-03-20");
    expect(entree(entrees, `${BASE}/votes/2025/03`)?.lastModified).toBe("2025-03-20");
    expect(entree(entrees, `${BASE}/votes/2025/01`)?.lastModified).toBe("2025-01-05");
    expect(entrees.some((e) => e.url.includes("/votes/inco"))).toBe(false);
  });

  it("ne date ni un groupe, ni un dossier, ni un sujet sans date", () => {
    const entrees = plan({
      dossiers: [{ uid: "DLA" }, { uid: "DLB", dateDepot: "2025-05-01" }],
      sujets: [{ slug: "s1" }, { slug: "s2", updatedAt: "2026-01-01" }],
    });
    expect(entree(entrees, `${BASE}/groupes/senat/sans-date`)?.lastModified).toBeUndefined();
    expect(entree(entrees, `${BASE}/dossiers/DLA`)?.lastModified).toBeUndefined();
    expect(entree(entrees, `${BASE}/dossiers/DLB`)?.lastModified).toBe("2025-05-01");
    expect(entree(entrees, `${BASE}/sujets/s1`)?.lastModified).toBeUndefined();
    expect(entree(entrees, `${BASE}/sujets/s2`)?.lastModified).toBe("2026-01-01");
  });
});
