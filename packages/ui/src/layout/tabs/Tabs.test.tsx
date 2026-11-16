import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { type TabItem, Tabs } from "./Tabs.tsx";

const items: TabItem[] = [
  { value: "amendements", label: "Amendements", count: 12, content: <p>Liste des amendements</p> },
  { value: "debats", label: "Débats", count: 1250, content: <p>Compte rendu des débats</p> },
  { value: "vote", label: "Vote", content: <p>Détail du vote</p> },
];

describe("Tabs", () => {
  it("nomme la liste d'onglets et annonce les compteurs", () => {
    const { getByRole } = renderWithProviders(<Tabs items={items} label="Détail du scrutin" />);
    expect(getByRole("tablist", { name: "Détail du scrutin" })).toBeInTheDocument();
    const premier = getByRole("tab", { name: /Amendements/ });
    expect(premier).toHaveAttribute("aria-selected", "true");
    expect(premier).toHaveTextContent("(12)");
    expect(getByRole("tabpanel")).toHaveTextContent("Liste des amendements");
  });

  it("accepte un compteur en texte, annoncé en toutes lettres", () => {
    const { getByRole } = renderWithProviders(
      <Tabs
        items={[
          ...items,
          {
            value: "censure",
            label: "49.3 et censure",
            count: "3 · 13",
            countLabel: "3 recours au 49.3, 13 motions de censure",
            content: <p>Recours et motions</p>,
          },
        ]}
        label="Bilan du gouvernement"
      />,
    );
    const onglet = getByRole("tab", { name: /49\.3 et censure/ });
    expect(onglet).toHaveTextContent("3 · 13");
    expect(onglet).toHaveTextContent("(3 recours au 49.3, 13 motions de censure)");
    expect(onglet.querySelector("[aria-hidden='true']")).toHaveTextContent("3 · 13");
  });

  it("change d'onglet au clic et aux flèches du clavier", async () => {
    const { getByRole } = renderWithProviders(<Tabs items={items} label="Détail du scrutin" />);
    await userEvent.click(getByRole("tab", { name: /Débats/ }));
    expect(getByRole("tab", { name: /Débats/ })).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowRight}");
    const vote = getByRole("tab", { name: "Vote" });
    expect(vote).toHaveFocus();
    expect(vote).toHaveAttribute("aria-selected", "true");
  });

  it("en mode contrôlé, signale le changement sans changer seul d'onglet", async () => {
    const onChange = vi.fn();
    const { getByRole } = renderWithProviders(
      <Tabs items={items} label="Détail du scrutin" value="vote" onChange={onChange} />,
    );
    expect(getByRole("tab", { name: "Vote" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(getByRole("tab", { name: /Amendements/ }));
    expect(onChange).toHaveBeenCalledWith("amendements");
    expect(getByRole("tab", { name: "Vote" })).toHaveAttribute("aria-selected", "true");
  });
});
