import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { FeedbackWidget } from "./FeedbackWidget.tsx";

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe("FeedbackWidget : cas limites", () => {
  it("envoie une appréciation seule, sans message ni adresse", async () => {
    const envoyer = vi.fn().mockResolvedValue(undefined);
    renderScreen(<FeedbackWidget envoyer={envoyer} />, { pathname: "/" });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Donner mon avis sur CLAIR" }));
    await screen.findByRole("dialog", { name: "Votre avis sur CLAIR" });
    await user.click(screen.getByRole("radio", { name: /Bien/ }));
    await user.click(screen.getByRole("button", { name: "Envoyer" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Merci pour votre retour.");
    expect(envoyer).toHaveBeenCalledWith(
      expect.objectContaining({ sentiment: "positif", message: undefined, email: undefined }),
    );
  });

  it("garde l'erreur quand le message ne contient que des espaces", async () => {
    const envoyer = vi.fn();
    renderScreen(<FeedbackWidget envoyer={envoyer} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Donner mon avis sur CLAIR" }));
    await screen.findByRole("dialog", { name: "Votre avis sur CLAIR" });
    await user.click(screen.getByRole("button", { name: "Envoyer" }));
    await user.type(screen.getByRole("textbox", { name: /Message/ }), "   ");
    expect(screen.getByRole("alert")).toHaveTextContent(/appréciation ou écrivez un message/);
    expect(envoyer).not.toHaveBeenCalled();
  });
});
