import { act, fireEvent } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { SearchInput } from "./SearchInput.tsx";

type ControlledProps = {
  label: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  debounceMs?: number;
  initial?: string;
};

/** Champ contrôlé par un état local, comme un écran qui le relie à l'URL. */
const Controlled = ({ initial = "", onChange, ...rest }: ControlledProps) => {
  const [value, setValue] = useState(initial);
  return (
    <>
      <SearchInput
        {...rest}
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
      <button type="button" onClick={() => setValue("")}>
        Réinitialiser
      </button>
    </>
  );
};

describe("SearchInput", () => {
  it("expose un champ de recherche nommé par son libellé, icône masquée", () => {
    const { getByRole, container } = renderWithProviders(
      <SearchInput label="Rechercher un député" value="" onChange={() => {}} />,
    );
    expect(getByRole("searchbox", { name: "Rechercher un député" })).toBeInTheDocument();
    expect(container.querySelector("svg[aria-hidden='true']")).not.toBeNull();
  });

  it("accepte un aria-label à la place d'un libellé visible", () => {
    const { getByRole } = renderWithProviders(
      <SearchInput aria-label="Rechercher" value="" onChange={() => {}} />,
    );
    expect(getByRole("searchbox", { name: "Rechercher" })).toBeInTheDocument();
  });

  it("transmet la saisie et la valide avec Entrée", async () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const { getByRole } = renderWithProviders(
      <Controlled label="Rechercher" onChange={onChange} onSubmit={onSubmit} />,
    );
    await userEvent.type(getByRole("searchbox"), "loi{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("loi");
    expect(onSubmit).toHaveBeenCalledWith("loi");
  });

  it("efface par le bouton accessible et rend le focus au champ", async () => {
    const onChange = vi.fn();
    const { getByRole, queryByRole } = renderWithProviders(
      <Controlled label="Rechercher" onChange={onChange} initial="Camille" />,
    );
    await userEvent.click(getByRole("button", { name: "Effacer la recherche" }));
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(getByRole("searchbox")).toHaveValue("");
    expect(getByRole("searchbox")).toHaveFocus();
    expect(queryByRole("button", { name: "Effacer la recherche" })).toBeNull();
  });

  it("efface avec Échap", async () => {
    const onChange = vi.fn();
    const { getByRole } = renderWithProviders(
      <Controlled label="Rechercher" onChange={onChange} initial="Camille" />,
    );
    getByRole("searchbox").focus();
    await userEvent.keyboard("{Escape}");
    expect(getByRole("searchbox")).toHaveValue("");
  });

  it("regroupe les frappes avec debounceMs", () => {
    vi.useFakeTimers();
    try {
      const onChange = vi.fn();
      const { getByRole } = renderWithProviders(
        <Controlled label="Rechercher" onChange={onChange} debounceMs={300} />,
      );
      const field = getByRole("searchbox");
      fireEvent.change(field, { target: { value: "l" } });
      fireEvent.change(field, { target: { value: "lo" } });
      fireEvent.change(field, { target: { value: "loi" } });
      expect(field).toHaveValue("loi");
      expect(onChange).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("loi");
    } finally {
      vi.useRealTimers();
    }
  });

  it("reprend une valeur réinitialisée de l'extérieur", async () => {
    const { getByRole } = renderWithProviders(
      <Controlled label="Rechercher" onChange={() => {}} initial="Camille" />,
    );
    await userEvent.click(getByRole("button", { name: "Réinitialiser" }));
    expect(getByRole("searchbox")).toHaveValue("");
  });

  it("ne rétablit pas une saisie en attente après une réinitialisation extérieure", () => {
    vi.useFakeTimers();
    try {
      const onChange = vi.fn();
      const { getByRole } = renderWithProviders(
        <Controlled label="Rechercher" onChange={onChange} debounceMs={300} initial="Camille" />,
      );
      const field = getByRole("searchbox");
      fireEvent.change(field, { target: { value: "Camille D" } });
      fireEvent.click(getByRole("button", { name: "Réinitialiser" }));
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(field).toHaveValue("");
      expect(onChange).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
