import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { ErrorScreen } from "./ErrorScreen.tsx";

describe("ErrorScreen", () => {
  it("annonce l'erreur et relance le chargement", async () => {
    const onRetry = vi.fn();
    const { getByRole } = renderScreen(<ErrorScreen onRetry={onRetry} />);
    expect(getByRole("alert")).toHaveTextContent("Une erreur est survenue");
    await userEvent.click(getByRole("button", { name: "Réessayer" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
