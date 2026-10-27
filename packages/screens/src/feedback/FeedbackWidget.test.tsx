import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { FeedbackWidget } from "./FeedbackWidget.tsx";
import { CLES, compterAction, doitRelancer, estPageDeValeur } from "./relance.ts";

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});
afterEach(() => vi.useRealTimers());

const ouvrir = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Donner mon avis sur CLAIR" }));
  return { user, dialogue: await screen.findByRole("dialog", { name: "Votre avis sur CLAIR" }) };
};

describe("FeedbackWidget", () => {
  it("ouvre un dialogue nommé et envoie le retour avec la page courante", async () => {
    const envoyer = vi.fn().mockResolvedValue(undefined);
    renderScreen(<FeedbackWidget envoyer={envoyer} />, { pathname: "/deputes/camille-exemple" });
    const { user } = await ouvrir();
    await user.click(screen.getByRole("radio", { name: /Bien/ }));
    await user.click(screen.getByRole("radio", { name: "Idée" }));
    await user.type(screen.getByRole("textbox", { name: /Message/ }), "Très clair");
    await user.click(screen.getByRole("button", { name: "Envoyer" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Merci pour votre retour.");
    expect(envoyer).toHaveBeenCalledWith({
      sentiment: "positif",
      type: "idee",
      message: "Très clair",
      email: undefined,
      page: "/deputes/camille-exemple",
      trigger: "passif",
      website: "",
    });
    expect(window.localStorage.getItem(CLES.repondu)).toBe("1");
  });

  it("annonce les erreurs de saisie sans rien envoyer", async () => {
    const envoyer = vi.fn();
    renderScreen(<FeedbackWidget envoyer={envoyer} />);
    const { user } = await ouvrir();
    await user.click(screen.getByRole("button", { name: "Envoyer" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/appréciation ou écrivez un message/);
    const champ = screen.getByRole("textbox", { name: /Message/ });
    expect(champ).toHaveAttribute("aria-invalid", "true");
    expect(champ).toHaveAccessibleDescription(/appréciation ou écrivez un message/);
    await user.type(champ, "Un mot");
    // L'erreur corrigée disparaît.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.type(
      screen.getByRole("textbox", { name: /Adresse électronique/ }),
      "pas-une-adresse",
    );
    await user.click(screen.getByRole("button", { name: "Envoyer" }));
    expect(screen.getByRole("textbox", { name: /Adresse électronique/ })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/Adresse électronique invalide/);
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("annonce l'échec de l'envoi et garde la saisie", async () => {
    renderScreen(<FeedbackWidget envoyer={vi.fn().mockRejectedValue(new Error("502"))} />);
    const { user } = await ouvrir();
    await user.type(screen.getByRole("textbox", { name: /Message/ }), "Bonjour");
    await user.click(screen.getByRole("button", { name: "Envoyer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/L'envoi a échoué/);
    expect(screen.getByRole("textbox", { name: /Message/ })).toHaveValue("Bonjour");
  });

  it("se ferme avec Échap et rend le focus au bouton", async () => {
    renderScreen(<FeedbackWidget envoyer={vi.fn()} />);
    const { user } = await ouvrir();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Donner mon avis sur CLAIR" })).toHaveFocus(),
    );
  });

  it("propose de donner son avis après deux fiches visitées, et se tait si on l'ignore", async () => {
    compterAction(window.sessionStorage, Date.now());
    renderScreen(<FeedbackWidget envoyer={vi.fn()} />, { pathname: "/scrutins/12" });
    expect(await screen.findByText("Un retour à nous faire ?")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Ignorer la proposition de donner mon avis" }),
    );
    expect(screen.queryByText("Un retour à nous faire ?")).not.toBeInTheDocument();
    expect(Number(window.localStorage.getItem(CLES.silence))).toBeGreaterThan(Date.now());
  });
});

describe("règles de relance", () => {
  it("reconnaît les pages de détail", () => {
    expect(estPageDeValeur("/deputes/camille-exemple")).toBe(true);
    expect(estPageDeValeur("/deputes/comparer")).toBe(false);
    expect(estPageDeValeur("/lobbying/actions")).toBe(false);
    expect(estPageDeValeur("/deputes")).toBe(false);
  });

  it("attend une minute après une seule action", () => {
    const session = new Map<string, string>();
    const stockage = {
      getItem: (k: string) => session.get(k) ?? null,
      setItem: (k: string, v: string) => void session.set(k, v),
    };
    const local = { getItem: () => null, setItem: () => undefined };
    compterAction(stockage, 1_000);
    expect(doitRelancer(stockage, local, 30_000)).toBe(false);
    expect(doitRelancer(stockage, local, 61_000)).toBe(true);
  });
});
