import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { Pagination } from "./Pagination.tsx";

const hrefFor = (page: number) => (page === 1 ? "/scrutins" : `/scrutins?page=${page}`);

describe("Pagination", () => {
  it("rend des liens dans une navigation nommée, page courante signalée", () => {
    const { getByRole } = renderWithProviders(<Pagination page={5} total={20} hrefFor={hrefFor} />);
    const nav = getByRole("navigation", { name: "Pagination" });
    expect(nav).toBeInTheDocument();
    expect(getByRole("link", { name: "Page 5" })).toHaveAttribute("aria-current", "page");
    expect(getByRole("link", { name: "Page 1" })).toHaveAttribute("href", "/scrutins");
    expect(getByRole("link", { name: "Page 20" })).toHaveAttribute("href", "/scrutins?page=20");
    expect(getByRole("link", { name: "Précédent" })).toHaveAttribute("href", "/scrutins?page=4");
    expect(getByRole("link", { name: "Précédent" })).toHaveAttribute("rel", "prev");
    expect(getByRole("link", { name: "Suivant" })).toHaveAttribute("href", "/scrutins?page=6");
  });

  it("n'offre pas de lien « Précédent » sur la première page", () => {
    const { queryByRole, getByText } = renderWithProviders(
      <Pagination page={1} total={3} hrefFor={hrefFor} />,
    );
    expect(queryByRole("link", { name: "Précédent" })).toBeNull();
    expect(getByText("Précédent")).toBeInTheDocument();
    expect(queryByRole("link", { name: "Suivant" })).toHaveAttribute("href", "/scrutins?page=2");
  });

  it("annonce la page courante dans la version compacte", () => {
    const { getByText } = renderWithProviders(<Pagination page={2} total={9} hrefFor={hrefFor} />);
    expect(getByText("Page 2 sur 9")).toBeInTheDocument();
  });

  it("en boutons, signale la page choisie", async () => {
    const onChange = vi.fn();
    const { getByRole } = renderWithProviders(
      <Pagination page={1} total={4} onChange={onChange} />,
    );
    expect(getByRole("button", { name: "Précédent" })).toBeDisabled();
    expect(getByRole("button", { name: "Page 1" })).toHaveAttribute("aria-current", "page");
    await userEvent.click(getByRole("button", { name: "Page 3" }));
    expect(onChange).toHaveBeenCalledWith(3);
    await userEvent.click(getByRole("button", { name: "Suivant" }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("ne rend rien pour une seule page", () => {
    const { queryByRole } = renderWithProviders(
      <Pagination page={1} total={1} hrefFor={hrefFor} />,
    );
    expect(queryByRole("navigation")).toBeNull();
  });

  it("borne une page hors limites : jamais « Page 9 sur 3 »", () => {
    const { getByText, queryByText } = renderWithProviders(
      <Pagination page={9} total={3} hrefFor={(page) => `/scrutins?page=${page}`} />,
    );
    expect(queryByText(/Page 9 sur 3/)).toBeNull();
    expect(getByText(/Page 3 sur 3/)).toBeInTheDocument();
  });
});
