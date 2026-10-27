import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { ContactScreen } from "./ContactScreen.tsx";

describe("ContactScreen", () => {
  it("liste les moyens de contact et invite à contribuer", () => {
    const { getByRole, getAllByRole } = renderScreen(<ContactScreen />);
    expect(getByRole("heading", { level: 1 })).toHaveTextContent("Contact");
    expect(getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Email",
      "X (Twitter)",
      "Signaler un bug",
      "Suggérer une fonctionnalité",
      "Contribuer au projet",
    ]);
    expect(getByRole("link", { name: "contact@clair.vote" })).toHaveAttribute(
      "href",
      "mailto:contact@clair.vote",
    );
    expect(getByRole("link", { name: /Ouvrir une issue/ })).toHaveAttribute(
      "href",
      "https://github.com/accelaire/CLAIR/issues/new?labels=bug",
    );
    expect(getByRole("link", { name: /Guide de contribution/ })).toHaveAttribute(
      "target",
      "_blank",
    );
  });
});
