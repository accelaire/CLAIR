'use client';

import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FAQItem {
  question: string;
  answer: string | React.ReactNode;
}

interface FAQAccordionProps {
  items: FAQItem[];
  defaultOpenIndex?: number;
}

export function FAQAccordion({ items, defaultOpenIndex = -1 }: FAQAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number>(defaultOpenIndex);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? -1 : index);
  };

  return (
    <div className="divide-y divide-border">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div key={index}>
            <button
              type="button"
              onClick={() => toggle(index)}
              className="flex w-full items-center justify-between py-5 text-left transition-colors"
            >
              <span className="font-semibold text-base pr-4">{item.question}</span>
              <div className="flex-shrink-0 rounded-full border border-border p-1">
                {isOpen ? (
                  <Minus className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Plus className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="pb-5 text-muted-foreground leading-relaxed whitespace-pre-line">
                    {item.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
