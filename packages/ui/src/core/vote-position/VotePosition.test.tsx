import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { VotePosition } from "./VotePosition.tsx";

describe("VotePosition", () => {
  it.each([
    ["pour", "Pour"],
    ["contre", "Contre"],
    ["abstention", "Abstention"],
    ["absent", "Absent"],
    ["non_votant", "Non-votant"],
  ] as const)("%s : libellé « %s » en plus de la couleur", (position, label) => {
    const { getByText } = renderWithProviders(<VotePosition position={position} />);
    expect(getByText(label)).toHaveAttribute("data-position", position);
  });

  it("masque l'icône aux lecteurs d'écran", () => {
    const { container } = renderWithProviders(<VotePosition position="contre" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
