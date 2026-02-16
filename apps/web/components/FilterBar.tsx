'use client';

import { ReactNode, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface FilterBarProps {
  search: ReactNode;
  children: ReactNode;
  activeFilterCount?: number;
  onClear?: () => void;
}

export function FilterBar({ search, children, activeFilterCount = 0, onClear }: FilterBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      {/* Desktop: inline layout */}
      <div className="mb-6 hidden md:flex md:flex-wrap md:items-center md:gap-3">
        {search}
        {children}
        {activeFilterCount > 0 && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Effacer
          </button>
        )}
      </div>

      {/* Mobile: search + filter button */}
      <div className="mb-6 flex items-center gap-3 md:hidden">
        <div className="flex-1 min-w-0">{search}</div>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="relative flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors shrink-0"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtres
          {activeFilterCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Mobile bottom sheet */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/50"
              onClick={() => setSheetOpen(false)}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl bg-background shadow-xl"
            >
              {/* Handle */}
              <div className="sticky top-0 bg-background pt-3 pb-2 px-6 border-b">
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/20" />
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Filtres</h3>
                  <div className="flex items-center gap-3">
                    {activeFilterCount > 0 && onClear && (
                      <button
                        type="button"
                        onClick={() => { onClear(); setSheetOpen(false); }}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Réinitialiser
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSheetOpen(false)}
                      className="rounded-full p-1.5 hover:bg-muted transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Filter content — date dropdown rendered inline so the sheet can scroll */}
              <div className="flex-1 space-y-4 overflow-y-auto p-6 pb-2 [&_[data-date-dropdown]]:static [&_[data-date-dropdown]]:shadow-none [&_[data-date-dropdown]]:border-0 [&_[data-date-dropdown]]:mt-2">
                {children}
              </div>

              {/* Apply button */}
              <div className="border-t bg-background p-4">
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Appliquer
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
