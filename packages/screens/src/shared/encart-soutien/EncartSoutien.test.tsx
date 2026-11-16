import { describe, expect, it } from "vitest";
import { renderScreen } from "../../test-utils.tsx";
import { EncartSoutien } from "./EncartSoutien.tsx";

describe("EncartSoutien", () => {
  it("rappelle la déduction fiscale et renvoie vers /soutenir", () => {
    const { getByRole, getByText } = renderScreen(<EncartSoutien />);
    expect(getByRole("complementary", { name: "Soutenir CLAIR" })).toBeInTheDocument();
    expect(getByText(/vous revient à 3,40/)).toBeInTheDocument();
    expect(getByRole("link", { name: "Soutenir CLAIR" })).toHaveAttribute("href", "/soutenir");
  });
});
