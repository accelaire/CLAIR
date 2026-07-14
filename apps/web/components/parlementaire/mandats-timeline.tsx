import { ReactNode } from 'react';
import Link from 'next/link';
import { ScrollText } from 'lucide-react';
import { legislatureLabel, mandatureLabel } from '@/lib/periodes';

export interface MandatParlementaireItem {
  legislature: number | null;
  mandature: number | null;
  dateDebut: string;
  dateFin: string | null;
  groupe: { slug: string; nom: string; couleur: string | null; legislature: number | null } | null;
  circonscription: { nom: string; departement: string; numero: number } | null;
}

function periodeLabel(m: MandatParlementaireItem, chambre: 'assemblee' | 'senat'): string {
  if (chambre === 'assemblee' && m.legislature != null) {
    return legislatureLabel(m.legislature);
  }
  if (m.mandature != null) {
    return mandatureLabel(m.mandature);
  }
  return 'Mandat';
}

function moisAnnee(date: string): string {
  return new Date(date).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
}

/**
 * Bloc « Mandats » unifié : la frise des mandats parlementaires (une période par
 * législature AN / mandature Sénat, avec le groupe et la circonscription de
 * l'époque) sert de colonne vertébrale, et les fonctions en commission de la
 * période en cours viennent s'y rattacher via `fonctionsCourantes`.
 *
 * Dégrade proprement : sans frise (une seule période connue, cas de la prod tant
 * que l'historique n'est pas ingéré), on rend les fonctions telles quelles.
 */
export function MandatsBlock({
  mandats,
  chambre,
  fonctionsCourantes,
}: {
  mandats: MandatParlementaireItem[];
  chambre: 'assemblee' | 'senat';
  fonctionsCourantes?: ReactNode;
}) {
  const groupeBase = chambre === 'senat' ? '/groupes/senat' : '/groupes/assemblee';

  const entete = (
    <div className="flex items-center gap-2 mb-4">
      <ScrollText className="h-5 w-5 text-blue-500" />
      <h2 className="text-xl font-semibold">Mandats</h2>
    </div>
  );

  // Pas de frise exploitable → on garde le rendu simple des fonctions.
  if (mandats.length === 0) {
    return (
      <div>
        {entete}
        {fonctionsCourantes}
      </div>
    );
  }

  return (
    <div>
      {entete}

      <ol className="relative space-y-5 border-l-2 border-muted pl-6">
        {mandats.map((m, i) => {
          const couleur = m.groupe?.couleur || '#888';
          const enCours = !m.dateFin;
          return (
            <li key={`${m.legislature ?? m.mandature ?? 'm'}-${i}`} className="relative">
              {/* Pastille sur le rail, couleur du groupe de la période */}
              <span
                className={`absolute -left-[1.85rem] top-1.5 h-3 w-3 rounded-full ring-2 ring-background ${
                  enCours ? '' : 'opacity-60'
                }`}
                style={{ backgroundColor: couleur }}
              />

              <div className={enCours ? '' : 'opacity-75'}>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-medium">{periodeLabel(m, chambre)}</span>
                  <span className="text-xs text-muted-foreground">
                    {moisAnnee(m.dateDebut)} → {enCours ? 'en cours' : moisAnnee(m.dateFin!)}
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  {m.groupe && (
                    <Link
                      href={`${groupeBase}/${m.groupe.slug}`}
                      className="inline-flex items-center gap-1.5 hover:text-foreground hover:underline"
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: couleur }} />
                      {m.groupe.nom}
                    </Link>
                  )}
                  {m.circonscription && (
                    <span>
                      {m.circonscription.nom} ({m.circonscription.departement})
                    </span>
                  )}
                </div>
              </div>

              {/* Fonctions en commission, rattachées à la période en cours */}
              {enCours && fonctionsCourantes && <div className="mt-3">{fonctionsCourantes}</div>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
