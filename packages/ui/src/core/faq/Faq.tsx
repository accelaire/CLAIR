"use client";

import { Accordion } from "@mantine/core";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import classes from "./Faq.module.css";

export type FaqItem = {
  question: string;
  answer: ReactNode;
};

export type FaqProps = {
  items: FaqItem[];
  /** Plusieurs réponses peuvent rester ouvertes en même temps. */
  multiple?: boolean;
  /** Positions (à partir de 0) des questions ouvertes au premier rendu. */
  defaultOpened?: number[];
  /** Niveau de titre des questions, selon la place de la FAQ dans la page. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
};

const itemValue = (index: number) => `question-${index}`;

/**
 * Foire aux questions en accordéon (Mantine `Accordion`) : chaque question est un titre qui
 * contient un bouton `aria-expanded` ; une seule réponse ouverte à la fois, ou plusieurs avec
 * `multiple`. Remplace `FAQAccordion` de apps/web (sans framer-motion).
 */
export const Faq = ({
  items,
  multiple = false,
  defaultOpened = [],
  headingLevel = 3,
}: FaqProps) => {
  const opened = defaultOpened.map(itemValue);
  const common = {
    order: headingLevel,
    chevron: <ChevronDown aria-hidden="true" />,
    classNames: {
      root: classes.root,
      item: classes.item,
      control: classes.control,
      label: classes.label,
      chevron: classes.chevron,
      content: classes.content,
    },
  };
  const children = items.map((item, index) => (
    <Accordion.Item key={item.question} value={itemValue(index)}>
      <Accordion.Control>{item.question}</Accordion.Control>
      <Accordion.Panel>{item.answer}</Accordion.Panel>
    </Accordion.Item>
  ));
  return multiple ? (
    <Accordion multiple defaultValue={opened} {...common}>
      {children}
    </Accordion>
  ) : (
    <Accordion defaultValue={opened[0] ?? null} {...common}>
      {children}
    </Accordion>
  );
};
