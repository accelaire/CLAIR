'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronDown, Landmark, MessageSquare, Users } from 'lucide-react';
import { ExpandableText } from '@/components/ui/expandable-text';
import type { InterventionScrutin } from './scrutin-debats-tab';

export interface AmendementDetail {
  id: string;
  uid: string;
  numero: string;
  articleVise: string | null;
  dispositif: string | null;
  exposeSommaire: string | null;
  auteurLibelle: string | null;
  sort: string | null;
  dateDepot: string | null;
  /** La prise de parole où l'amendement a été défendu en séance, si on la connaît. */
  defense?: InterventionScrutin | null;
}

interface ScrutinAmendementsTabProps {
  amendements: AmendementDetail[];
  chambre: string;
  /** Ouvre l'onglet du débat de ce vote. */
  onVoirDebat?: () => void;
  /** Le passage du vote dans la page de la séance, quand elle existe. */
  seanceHref?: string | null;
}

/**
 * L'auteur et le nombre de cosignataires, plutôt que la liste entière.
 *
 * Un amendement de groupe porte jusqu'à 70 noms dans `auteurLibelle` — « Mme
 * Lepvraud, Mme Abomangoli, …, Mme Trouvé et M. Vannier » : l'en-tête devenait
 * un paragraphe. Le premier nom est celui du premier signataire ; la liste
 * complète reste lisible en dépliant l'amendement.
 */
function auteurEtCosignataires(libelle: string): { court: string; nbCosignataires: number } {
  const noms = libelle
    .split(/,\s*|\s+et\s+/u)
    .map((nom) => nom.trim())
    .filter(Boolean);
  if (noms.length <= 2) return { court: libelle, nbCosignataires: 0 };
  return { court: noms[0], nbCosignataires: noms.length - 1 };
}

export function ScrutinAmendementsTab({
  amendements,
  chambre,
  onVoirDebat,
  seanceHref,
}: ScrutinAmendementsTabProps) {
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
        const auteurs = a.auteurLibelle ? auteurEtCosignataires(a.auteurLibelle) : null;
        return (
          <div key={a.id} className="pb-4">
            <button
              type="button"
              onClick={() => toggle(a.id)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between py-4 text-left transition-colors"
            >
              <div className="flex-1 min-w-0 pr-4">
                <span className="font-semibold text-base">
                  Amendement n°{a.numero}
                </span>
                {auteurs && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    par {auteurs.court}
                    {auteurs.nbCosignataires > 0 && (
                      <> et {auteurs.nbCosignataires} cosignataire{auteurs.nbCosignataires > 1 ? 's' : ''}</>
                    )}
                  </p>
                )}
              </div>
              <span className="flex flex-shrink-0 items-center gap-1 text-xs text-muted-foreground">
                {isOpen ? 'Replier' : 'Texte et exposé'}
                <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </span>
            </button>

            {/* La défense en séance, visible sans rien déplier : c'est la
                parole de l'auteur sur ce qu'il demande, et la raison la plus
                directe de venir sur la page d'un vote d'amendement. */}
            {a.defense && (
              <DefenseEnSeance
                defense={a.defense}
                chambre={chambre}
                onVoirDebat={onVoirDebat}
                seanceHref={seanceHref}
              />
            )}

            {isOpen && (
              <div className="pt-4 space-y-4">
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
                {auteurs && auteurs.nbCosignataires > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Signataires</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{a.auteurLibelle}</p>
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

function DefenseEnSeance({
  defense,
  chambre,
  onVoirDebat,
  seanceHref,
}: {
  defense: InterventionScrutin;
  chambre: string;
  onVoirDebat?: () => void;
  seanceHref?: string | null;
}) {
  const p = defense.parlementaire;
  const nom = p
    ? `${p.prenom} ${p.nom}`
    : [defense.orateurPrenom, defense.orateurNom].filter(Boolean).join(' ');
  const profileHref = p ? (chambre === 'senat' ? `/senateurs/${p.slug}` : `/deputes/${p.slug}`) : null;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 sm:p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
        Défendu en séance
      </p>
      <div className="flex items-start gap-3">
        <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-full bg-muted">
          {p?.photoUrl ? (
            <Image src={p.photoUrl} alt="" fill className="object-cover" unoptimized />
          ) : (
            <Users className="absolute inset-0 m-auto h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {profileHref ? (
              <Link href={profileHref} className="text-sm font-medium hover:text-primary hover:underline">
                {nom}
              </Link>
            ) : (
              <span className="text-sm font-medium">{nom}</span>
            )}
            {p?.groupe && (
              <span
                className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: p.groupe.couleur || '#888' }}
              >
                {p.groupe.nom}
              </span>
            )}
          </div>
          <ExpandableText
            text={defense.contenu}
            hasMore={defense.hasMore}
            interventionId={defense.id}
            sourceUrl={defense.sourceUrl}
            maxLines={4}
          />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {onVoirDebat && (
              <button
                type="button"
                onClick={onVoirDebat}
                className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Lire le débat de ce vote
              </button>
            )}
            {seanceHref && (
              <Link
                href={seanceHref}
                className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
              >
                <Landmark className="h-3.5 w-3.5" />
                Voir dans la séance
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
