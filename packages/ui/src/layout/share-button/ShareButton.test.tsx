import { waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { ShareButton } from "./ShareButton.tsx";

afterEach(() => {
  Reflect.deleteProperty(navigator, "share");
});

describe("ShareButton", () => {
  it("copie le lien sans partage natif et annonce la confirmation", async () => {
    const user = userEvent.setup();
    const { getByRole, getByText } = renderWithProviders(
      <ShareButton url="https://clair.vote/scrutins/1234" />,
    );
    await user.click(getByRole("button", { name: "Partager" }));
    expect(await navigator.clipboard.readText()).toBe("https://clair.vote/scrutins/1234");
    expect(getByRole("button", { name: "Lien copié" })).toBeInTheDocument();
    expect(getByText("Lien copié dans le presse-papier.")).toHaveAttribute("aria-live", "polite");
  });

  it("rend une adresse relative absolue", async () => {
    const user = userEvent.setup();
    const { getByRole } = renderWithProviders(<ShareButton url="/scrutins/1234" />);
    await user.click(getByRole("button", { name: "Partager" }));
    expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/scrutins/1234`);
  });

  it("utilise le partage natif quand il existe", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    const user = userEvent.setup();
    const { getByRole } = renderWithProviders(
      <ShareButton url="https://clair.vote/deputes" title="Députés" iconOnly />,
    );
    await user.click(getByRole("button", { name: "Partager" }));
    await waitFor(() =>
      expect(share).toHaveBeenCalledWith({
        title: "Députés",
        text: undefined,
        url: "https://clair.vote/deputes",
      }),
    );
    expect(getByRole("button", { name: "Partager" })).toBeInTheDocument();
  });
});
