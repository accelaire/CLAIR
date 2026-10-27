import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileText, MessageSquare, Vote } from "lucide-react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { type TabItem, Tabs } from "./Tabs.tsx";

const items: TabItem[] = [
  {
    value: "amendements",
    label: "Amendements",
    count: 12,
    icon: <FileText />,
    content: <p>Les 12 amendements examinés avant ce vote.</p>,
  },
  {
    value: "debats",
    label: "Débat du vote",
    count: 48,
    icon: <MessageSquare />,
    content: <p>Les 48 interventions qui précèdent le vote.</p>,
  },
  {
    value: "vote",
    label: "Vote",
    count: 577,
    icon: <Vote />,
    content: <p>Le détail du vote, groupe par groupe.</p>,
  },
];

const meta = {
  title: "Composants/Mise en page/Tabs",
  component: Tabs,
  args: { items, label: "Détail du scrutin" },
  argTypes: {
    items: {
      description: "Onglets : valeur, libellé, compteur et icône optionnels, contenu du panneau.",
      control: false,
      table: { category: "Contenu" },
    },
    label: { description: "Nom accessible de la liste d'onglets.", table: { category: "Contenu" } },
    value: {
      description: "Onglet actif (mode contrôlé, par exemple lu dans l'URL).",
      control: "select",
      options: ["amendements", "debats", "vote"],
      table: { category: "État" },
    },
    defaultValue: {
      description: "Onglet actif au premier rendu (mode non contrôlé).",
      table: { category: "État" },
    },
    onChange: { description: "Appelé au changement d'onglet.", table: { category: "Événements" } },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Onglets accessibles (Mantine `Tabs`), avec compteur optionnel ; en mode contrôlé, l'onglet actif peut vivre dans l'URL. Remplace les onglets des fiches et de la page d'un scrutin dans apps/web.",
      },
    },
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};

/** Les flèches du clavier passent d'un onglet à l'autre et affichent son panneau. */
export const NavigationClavier: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("tab", { name: /Amendements/ }));
    await userEvent.keyboard("{ArrowRight}");
    const debats = canvas.getByRole("tab", { name: /Débat du vote/ });
    await expect(debats).toHaveFocus();
    await expect(debats).toHaveAttribute("aria-selected", "true");
    await expect(canvas.getByText("Les 48 interventions qui précèdent le vote.")).toBeVisible();
  },
};

/** Onglet actif synchronisé avec l'URL (`?onglet=…`), simulée ici par un état local. */
export const SynchroniseUrl: Story = {
  render: (args) => {
    const [onglet, setOnglet] = useState("vote");
    return (
      <div>
        <p style={{ color: "var(--clair-texte-mention)" }}>
          Adresse : <code>/scrutins/1234?onglet={onglet}</code>
        </p>
        <Tabs {...args} value={onglet} onChange={setOnglet} />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("tab", { name: /Vote/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.click(canvas.getByRole("tab", { name: /Amendements/ }));
    await expect(canvas.getByText("/scrutins/1234?onglet=amendements")).toBeVisible();
  },
};

export const SansCompteur: Story = {
  args: {
    items: [
      { value: "activite", label: "Activité", content: <p>Activité de Camille Exemple.</p> },
      { value: "votes", label: "Votes", content: <p>Votes de Camille Exemple.</p> },
      { value: "mandats", label: "Mandats", content: <p>Mandats de Camille Exemple.</p> },
    ],
    label: "Fiche de Camille Exemple",
  },
};

export const Mobile: Story = { globals: { viewport: { value: "xs" } } };

export const Sombre: Story = { globals: { theme: "dark" } };
