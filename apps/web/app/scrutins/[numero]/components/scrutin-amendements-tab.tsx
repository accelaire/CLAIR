'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface AmendementDetail {
  id: string;
  uid: string;
  numero: string;
  articleVise: string | null;
  dispositif: string | null;
  exposeSommaire: string | null;
  auteurLibelle: string | null;
  sort: string | null;
  dateDepot: string | null;
}

interface ScrutinAmendementsTabProps {
  amendements: AmendementDetail[];
}

export function ScrutinAmendementsTab({ amendements }: ScrutinAmendementsTabProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="divide-y divide-border">
      {amendements.map((a) => {
        const isOpen = openIds.has(a.id);
        return (
          <div key={a.id}>
            <button
              type="button"
              onClick={() => toggle(a.id)}
              className="w-full flex items-center justify-between py-4 text-left transition-colors"
            >
              <div className="flex-1 min-w-0 pr-4">
                <span className="font-semibold text-base">
                  Amendement n°{a.numero}
                </span>
                {a.auteurLibelle && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    par {a.auteurLibelle}
                  </p>
                )}
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <div className="pb-5 space-y-4">
                {a.dispositif && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Texte de l&apos;amendement</h4>
                    <div className="bg-muted/50 text-sm text-muted-foreground leading-relaxed rounded-lg p-4">
                      <div dangerouslySetInnerHTML={{ __html: a.dispositif.replace(/\n/g, '<br/>') }} />
                    </div>
                  </div>
                )}
                {a.exposeSommaire && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Exposé des motifs</h4>
                    <div className="bg-muted/50 text-sm text-muted-foreground leading-relaxed rounded-lg p-4">
                      <div dangerouslySetInnerHTML={{ __html: a.exposeSommaire.replace(/\n/g, '<br/>') }} />
                    </div>
                  </div>
                )}
                {!a.dispositif && !a.exposeSommaire && (
                  <p className="text-sm text-muted-foreground italic">Contenu non disponible</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
