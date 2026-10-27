import type { Meta, StoryObj } from "@storybook/react-vite";
import { Footer } from "../footer/Footer.tsx";
import { footerExemple } from "../footer/fixtures.ts";
import { navigationExemple } from "../header/fixtures.ts";
import { Header } from "../header/Header.tsx";
import { AppShell } from "./AppShell.tsx";

const meta = {
  title: "Composants/Mise en page/AppShell",
  component: AppShell,
  args: {
    header: (
      <Header navigation={navigationExemple} cta={{ label: "Nous soutenir", href: "/soutenir" }} />
    ),
    footer: <Footer {...footerExemple} />,
    children: (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 16px" }}>
        <h1>Titre de la page</h1>
        <p>Contenu de la page.</p>
      </div>
    ),
  },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Cadre de toutes les pages : lien d'évitement, en-tête, contenu principal, pied de page.",
      },
    },
  },
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};
export const Mobile: Story = { globals: { viewport: { value: "xs" } } };
export const Sombre: Story = { globals: { theme: "dark" } };
