import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { LEGAL_PAGES, type LegalPageSlug, PageLegaleScreen } from "./PageLegaleScreen.tsx";

const meta = {
  title: "Écrans/Page légale",
  component: PageLegaleScreen,
  args: { page: "cgu" },
  argTypes: {
    page: {
      description: "Page à afficher : son contenu vit dans `<page>.ts`.",
      control: {
        type: "select",
        labels: {
          cgu: "Conditions générales d'utilisation",
          confidentialite: "Politique de confidentialité",
          "mentions-legales": "Mentions légales",
        },
      },
      options: Object.keys(LEGAL_PAGES),
      table: { category: "Contenu" },
    },
  },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Routes `/cgu`, `/confidentialite` et `/mentions-legales`. Titre, date de mise à jour, sommaire des sections (ancres) puis sections titrées. Page éditoriale, sans appel à l'API.",
      },
    },
  },
} satisfies Meta<typeof PageLegaleScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Une story par page : titre, date, sommaire relié aux sections ; le sommaire se parcourt au clavier. */
const pageLegale = (page: LegalPageSlug): Story => ({
  args: { page },
  play: async ({ canvasElement }) => {
    const ecran = within(canvasElement);
    const contenu = LEGAL_PAGES[page];
    await expect(ecran.getByRole("heading", { level: 1 })).toHaveTextContent(contenu.title);
    await expect(
      ecran.getByText(`Dernière mise à jour : ${contenu.updatedAt}`),
    ).toBeInTheDocument();
    const sommaire = ecran.getByRole("navigation", { name: "Sommaire" });
    const liens = within(sommaire).getAllByRole("link");
    await expect(liens.map((lien) => lien.getAttribute("href"))).toEqual(
      contenu.sections.map((section) => `#${section.id}`),
    );
    for (const section of contenu.sections) {
      await expect(canvasElement.querySelector(`[id="${section.id}"]`)).not.toBeNull();
    }
    await userEvent.tab();
    await expect(liens[0]).toHaveFocus();
  },
});

export const Defaut: Story = pageLegale("cgu");
export const Confidentialite: Story = pageLegale("confidentialite");
export const MentionsLegales: Story = pageLegale("mentions-legales");

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
