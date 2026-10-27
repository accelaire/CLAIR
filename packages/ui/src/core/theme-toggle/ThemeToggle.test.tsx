import { theme } from "@clair/theme";
import { MantineProvider } from "@mantine/core";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { ThemeToggle } from "./ThemeToggle.tsx";

describe("ThemeToggle", () => {
  it("annonce le thème vers lequel il bascule", () => {
    const { getByRole } = renderWithProviders(<ThemeToggle />);
    expect(getByRole("button", { name: "Passer au thème sombre" })).toBeInTheDocument();
  });

  it("bascule réellement le thème au clic, dans les deux sens", async () => {
    // Sans forceColorScheme (posé par renderWithProviders), pour que le clic ait un effet.
    const { findByRole } = render(
      <MantineProvider theme={theme} defaultColorScheme="light">
        <ThemeToggle />
      </MantineProvider>,
    );
    await userEvent.click(await findByRole("button", { name: "Passer au thème sombre" }));
    expect(document.documentElement).toHaveAttribute("data-mantine-color-scheme", "dark");
    await userEvent.click(await findByRole("button", { name: "Passer au thème clair" }));
    expect(document.documentElement).toHaveAttribute("data-mantine-color-scheme", "light");
  });
});
