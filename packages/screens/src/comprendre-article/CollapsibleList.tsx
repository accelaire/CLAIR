"use client";

import { Button } from "@clair/ui";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Children, type ReactNode, useId, useState } from "react";

/**
 * Liste longue repliée : seuls les `visible` premiers éléments sont affichés, un bouton
 * (`aria-expanded`) déplie le reste. Reprend `SORTSList` de apps/web.
 */
export const CollapsibleList = ({
  visible,
  moreLabel,
  className,
  columns,
  children,
}: {
  visible: number;
  /** Libellé du bouton replié (« Voir 28 autres sorts »). */
  moreLabel: string;
  className?: string;
  columns: number;
  children: ReactNode;
}) => {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const items = Children.toArray(children);
  const hidden = items.length - visible;
  return (
    <div>
      <ul id={listId} className={className} data-columns={columns}>
        {expanded ? items : items.slice(0, visible)}
      </ul>
      {hidden > 0 ? (
        <Button
          variant="tertiaire"
          size="sm"
          aria-expanded={expanded}
          aria-controls={listId}
          icon={expanded ? <ChevronUp /> : <ChevronDown />}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Masquer" : moreLabel}
        </Button>
      ) : null}
    </div>
  );
};
