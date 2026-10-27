import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { MultiSelectFilter } from "./MultiSelectFilter.tsx";

const options = [
  { value: "energie", label: "Énergie", count: 1280 },
  { value: "sante", label: "Santé" },
  { value: "agriculture", label: "Agriculture" },
];

const Controlled = ({ onChange }: { onChange: (value: string[]) => void }) => {
  const [value, setValue] = useState<string[]>([]);
  return (
    <MultiSelectFilter
      label="Secteurs"
      options={options}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
};

describe("MultiSelectFilter", () => {
  it("est libellé et annonce qu'aucun élément n'est choisi", () => {
    const { getByRole } = renderWithProviders(
      <MultiSelectFilter label="Secteurs" options={options} value={[]} onChange={() => {}} />,
    );
    expect(getByRole("combobox", { name: "Secteurs" })).toBeInTheDocument();
    expect(getByRole("status")).toHaveTextContent("Aucun élément choisi");
  });

  it("affiche et annonce le nombre d'éléments choisis", () => {
    const { getByRole } = renderWithProviders(
      <MultiSelectFilter
        label="Secteurs"
        options={options}
        value={["energie", "sante"]}
        onChange={() => {}}
      />,
    );
    // Le nombre n'est plus dans le nom (il était lu deux fois) : il décrit le champ.
    const champ = getByRole("combobox", { name: "Secteurs" });
    expect(champ).toHaveAccessibleDescription("2 éléments choisis");
    expect(getByRole("status")).toHaveTextContent("2 éléments choisis");
  });

  it("cherche sans tenir compte des accents et choisit au clavier", async () => {
    const onChange = vi.fn();
    const { getByRole, getAllByRole } = renderWithProviders(<Controlled onChange={onChange} />);
    const field = getByRole("combobox", { name: "Secteurs" });
    await userEvent.click(field);
    await userEvent.type(field, "energ");
    const found = getAllByRole("option", { hidden: true });
    expect(found).toHaveLength(1);
    expect(found[0]).toHaveTextContent("Énergie");
    expect(found[0]).toHaveTextContent("1 280");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(["energie"]);
    expect(getByRole("status")).toHaveTextContent("1 élément choisi");
  });

  it("vide la sélection avec le bouton accessible", async () => {
    const onChange = vi.fn();
    const { getByRole } = renderWithProviders(
      <MultiSelectFilter
        label="Secteurs"
        options={options}
        value={["sante"]}
        onChange={onChange}
      />,
    );
    await userEvent.click(getByRole("button", { name: "Tout désélectionner" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("annonce la limite de choix et dit quand elle est atteinte", () => {
    const { getByRole, getByText } = renderWithProviders(
      <MultiSelectFilter
        label="Secteurs"
        options={options}
        value={["energie", "sante"]}
        onChange={() => {}}
        maxValues={2}
      />,
    );
    expect(getByRole("status")).toHaveTextContent(
      "2 éléments choisis. Limite de 2 choix atteinte.",
    );
    expect(getByText("Limite de 2 choix atteinte.")).toBeVisible();
  });
});
