import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../../test-utils.tsx";
import { Blocks, RichText } from "./RichText.tsx";
import {
  br,
  code,
  externalLink,
  labelled,
  link,
  list,
  orderedList,
  paragraph,
  strong,
} from "./rich-text.ts";

describe("RichText", () => {
  it("rend une chaîne simple telle quelle", () => {
    renderScreen(
      <p>
        <RichText text="Texte simple" />
      </p>,
    );
    expect(screen.getByText("Texte simple")).toBeInTheDocument();
  });

  it("rend gras, italique, code, retour à la ligne et liens", () => {
    const { container } = renderScreen(
      <p>
        <RichText
          text={[
            ...labelled("Libellé", "suite"),
            { em: "penché" },
            br,
            code("pnpm check"),
            link("Méthodologie", "/methodologie"),
            externalLink("Source", "https://exemple.fr"),
            strong("fort"),
          ]}
        />
      </p>,
    );
    expect(screen.getByText("Libellé").tagName).toBe("STRONG");
    expect(screen.getByText("penché").tagName).toBe("EM");
    expect(screen.getByText("pnpm check").tagName).toBe("CODE");
    expect(container.querySelector("br")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Méthodologie" })).toHaveAttribute(
      "href",
      "/methodologie",
    );
    expect(screen.getByRole("link", { name: /Source/ })).toHaveAttribute(
      "href",
      "https://exemple.fr",
    );
  });
});

describe("Blocks", () => {
  it("rend paragraphes, listes à puces ou numérotées et sous-parties", () => {
    renderScreen(
      <Blocks
        blocks={[
          paragraph("Un paragraphe."),
          list("Premier", "Second"),
          orderedList("Un", "Deux"),
          { type: "labelled", label: "Données collectées :", blocks: [paragraph("Aucune.")] },
        ]}
      />,
    );
    expect(screen.getByText("Un paragraphe.")).toBeInTheDocument();
    const listes = screen.getAllByRole("list");
    expect(listes).toHaveLength(2);
    expect(listes[0]?.tagName).toBe("UL");
    expect(listes[1]?.tagName).toBe("OL");
    expect(within(listes[1] as HTMLElement).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Données collectées :")).toBeInTheDocument();
    expect(screen.getByText("Aucune.")).toBeInTheDocument();
  });
});
