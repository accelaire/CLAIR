'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { HelpCircle } from 'lucide-react';

interface DidacticielTooltipProps {
  content: string;
  learnMoreHref?: string;
  learnMoreLabel?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

const positionClasses: Record<string, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

export function DidacticielTooltip({
  content,
  learnMoreHref,
  learnMoreLabel = 'En savoir plus',
  position = 'bottom',
  className = '',
}: DidacticielTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Click outside to close (mobile)
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={ref} className={`relative inline-flex group/tooltip ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center focus:outline-none"
        aria-label="Aide"
      >
        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors" />
      </button>

      {/* Desktop: hover — Mobile: click toggle */}
      <div
        className={`
          absolute z-50 w-64 rounded-lg border bg-popover p-3 shadow-md text-sm text-popover-foreground
          ${positionClasses[position]}
          hidden group-hover/tooltip:block
          ${isOpen ? '!block' : ''}
        `}
      >
        <p className="leading-relaxed">{content}</p>
        {learnMoreHref && (
          <Link
            href={learnMoreHref}
            className="mt-2 inline-flex items-center text-xs font-medium text-primary hover:underline"
          >
            {learnMoreLabel} &rarr;
          </Link>
        )}
      </div>
    </div>
  );
}
