import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { ChambreSwitch } from "./ChambreSwitch.tsx";

describe("ChambreSwitch", () => {
  it("présente un groupe de radios nommé par sa légende", () => {
    const { getByRole, getAllByRole } = renderWithProviders(
      <ChambreSwitch value="" onChange={() => {}} />,
    );
    expect(getByRole("group", { name: "Chambre" })).toBeInTheDocument();
    expect(getByRole("radiogroup", { name: "Chambre" })).toBeInTheDocument();
    expect(getAllByRole("radio")).toHaveLength(3);
    expect(getByRole("radio", { name: "Les deux" })).toBeChecked();
  });

  it("renvoie la chambre choisie, et une chaîne vide pour les deux", async () => {
    const onChange = vi.fn();
    const { getByRole } = renderWithProviders(<ChambreSwitch value="senat" onChange={onChange} />);
    expect(getByRole("radio", { name: "Sénat" })).toBeChecked();
    await userEvent.click(getByRole("radio", { name: "Assemblée nationale" }));
    expect(onChange).toHaveBeenLastCalledWith("assemblee");
    await userEvent.click(getByRole("radio", { name: "Les deux" }));
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("se pilote au clavier", async () => {
    const onChange = vi.fn();
    const { getByRole } = renderWithProviders(<ChambreSwitch value="" onChange={onChange} />);
    await userEvent.tab();
    expect(getByRole("radio", { name: "Les deux" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("assemblee");
  });

  it("peut se limiter aux deux chambres et garder un nom complet en compact", () => {
    const { getAllByRole, getByRole } = renderWithProviders(
      <ChambreSwitch value="senat" onChange={() => {}} withBoth={false} compact />,
    );
    expect(getAllByRole("radio")).toHaveLength(2);
    expect(getByRole("radio", { name: "Assemblée nationale" })).toBeInTheDocument();
  });

  it("se désactive", () => {
    const { getByRole } = renderWithProviders(
      <ChambreSwitch value="" onChange={() => {}} disabled />,
    );
    expect(getByRole("radio", { name: "Sénat" })).toBeDisabled();
  });
});
