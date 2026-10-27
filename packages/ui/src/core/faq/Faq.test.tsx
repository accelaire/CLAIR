import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { Faq } from "./Faq.tsx";
import { questionsExemple } from "./fixtures.ts";

const question = (name: string) => ({ name });

describe("Faq", () => {
  it("rend chaque question comme un titre contenant un bouton replié", () => {
    const { getAllByRole, getByRole } = renderWithProviders(
      <Faq items={questionsExemple} headingLevel={2} />,
    );
    expect(getAllByRole("heading", { level: 2 })).toHaveLength(3);
    expect(getByRole("button", question("D'où viennent les données ?"))).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("n'ouvre qu'une réponse à la fois", async () => {
    const { getByRole } = renderWithProviders(<Faq items={questionsExemple} defaultOpened={[0]} />);
    const premiere = getByRole("button", question("D'où viennent les données ?"));
    const deuxieme = getByRole("button", question("Les résumés sont-ils officiels ?"));
    expect(premiere).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(deuxieme);
    expect(deuxieme).toHaveAttribute("aria-expanded", "true");
    expect(premiere).toHaveAttribute("aria-expanded", "false");
  });

  it("garde plusieurs réponses ouvertes avec multiple", async () => {
    const { getByRole } = renderWithProviders(
      <Faq items={questionsExemple} multiple defaultOpened={[0]} />,
    );
    const derniere = getByRole("button", question("Comment signaler une erreur ?"));
    derniere.focus();
    await userEvent.keyboard("{Enter}");
    expect(derniere).toHaveAttribute("aria-expanded", "true");
    expect(getByRole("button", question("D'où viennent les données ?"))).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("relie la réponse à sa question", () => {
    const { getByRole } = renderWithProviders(<Faq items={questionsExemple} defaultOpened={[0]} />);
    expect(getByRole("region", question("D'où viennent les données ?"))).toHaveTextContent(
      "données ouvertes",
    );
  });
});
