import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { SortSelect } from "./SortSelect.tsx";

const options = [
  { value: "presence", label: "Présence" },
  { value: "nom", label: "Alphabétique" },
];

describe("SortSelect", () => {
  it("est libellé et affiche le tri choisi", () => {
    const { getByRole } = renderWithProviders(
      <SortSelect value="nom" onChange={() => {}} options={options} />,
    );
    const select = getByRole("combobox", { name: "Trier par" });
    expect(select).toHaveValue("nom");
    expect(getByRole("option", { name: "Présence" })).toBeInTheDocument();
  });

  it("transmet le nouveau tri", async () => {
    const onChange = vi.fn();
    const { getByRole } = renderWithProviders(
      <SortSelect value="presence" onChange={onChange} options={options} label="Classer par" />,
    );
    await userEvent.selectOptions(getByRole("combobox", { name: "Classer par" }), "nom");
    expect(onChange).toHaveBeenCalledWith("nom");
  });

  it("garde un nom accessible quand le libellé est masqué", () => {
    const { getByRole } = renderWithProviders(
      <SortSelect value="nom" onChange={() => {}} options={options} hideLabel disabled />,
    );
    expect(getByRole("combobox", { name: "Trier par" })).toBeDisabled();
  });
});
