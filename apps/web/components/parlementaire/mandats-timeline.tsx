import Link from 'next/link';
import { ScrollText } from 'lucide-react';
import { legislatureLabel, mandatureLabel, sessionForDate } from '@/lib/periodes';
import { mandatDeChaqueFonction } from '@/lib/fonctions-par-mandat';
import { FonctionsMandat, type FonctionItem } from './fonctions-mandat';

export interface MandatParlementaireItem {
  /** Chambre du MANDAT, qui peut différer de celle de la fiche (député élu sénateur). */
  chambre?: string;
  legislature: number | null;
  mandature: number | null;
  dateDebut: string;
  dateFin: string | null;
  groupe: { slug: string; nom: string; couleur: string | null; legislature: number | null } | null;
  circonscription: { nom: string; departement: string; numero: number } | null;
}

type Chambre = 'assemblee' | 'senat';

function chambreDuMandat(m: MandatParlementaireItem, chambreFiche: Chambre): Chambre {
  return m.chambre === 'assemblee' || m.chambre === 'senat' ? m.chambre : chambreFiche;
}

function fonction(chambre: Chambre, sexe: string | null | undefined): string {
  const f = sexe === 'F';
  if (chambre === 'assemblee') return f ? 'Députée' : 'Député';
  return f ? 'Sénatrice' : 'Sénateur';
}

function periodeLabel(m: MandatParlementaireItem, chambre: Chambre): string {
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
 * l'époque) sert de colonne vertébrale, et chaque fonction (commission, groupe
 * d'études, mission…) s'y range sous le mandat de sa chambre qui la recouvre
 * (`lib/fonctions-par-mandat`).
 *
 * Dégrade proprement : sans frise, on rend les fonctions telles quelles.
 */
export function MandatsBlock({
  mandats: mandatsRecus,
  chambre,
  sexe,
  fonctions = [],
}: {
  mandats: MandatParlementaireItem[];
  /** Chambre de la fiche : celle des mandats qui ne disent pas la leur. */
  chambre: Chambre;
  sexe?: string | null;
  fonctions?: FonctionItem[];
}) {
  // Du plus récent au plus ancien. L'API trie par législature puis par
  // mandature : dans une frise qui mêle les deux chambres, cet ordre les
  // regrouperait au lieu de suivre le temps.
  const mandats = [...mandatsRecus].sort((a, b) => b.dateDebut.localeCompare(a.dateDebut));
  // Une frise des deux chambres nomme la fonction de chaque période : sans
  // cela, « XVe législature » et « Mandature 2020 » se suivent sans dire que
  // l'une est un mandat de député et l'autre de sénateur.
  const deuxChambres = new Set(mandats.map((m) => chambreDuMandat(m, chambre))).size > 1;

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
        <FonctionsMandat fonctions={fonctions} enCours />
      </div>
    );
  }

  const rattachement = mandatDeChaqueFonction(mandats, fonctions, chambre);
  const fonctionsDe = (i: number) => fonctions.filter((_, j) => rattachement[j] === i);

  return (
    <div>
      {entete}

      <ol className="relative space-y-5 border-l-2 border-muted pl-6">
        {mandats.map((m, i) => {
          const couleur = m.groupe?.couleur || '#888';
          const enCours = !m.dateFin;
          const chambreMandat = chambreDuMandat(m, chambre);
          const groupeBase = chambreMandat === 'senat' ? '/groupes/senat' : '/groupes/assemblee';
          // Le lien groupe porte la période de CE mandat, pour atterrir sur la
          // composition d'époque et non sur celle d'aujourd'hui.
          //  - AN : la législature du mandat (la cohorte EST la période).
          //  - Sénat : une mandature couvre ~6 sessions ; on vise la session de DÉBUT
          //    du mandat (le groupe tel qu'à l'entrée). Le mandat en cours reste sans
          //    paramètre = page live (session courante).
          const groupeHref = m.groupe
            ? chambreMandat === 'assemblee'
              ? `${groupeBase}/${m.groupe.slug}${m.legislature != null ? `?legislature=${m.legislature}` : ''}`
              : `${groupeBase}/${m.groupe.slug}${enCours ? '' : `?session=${sessionForDate(new Date(m.dateDebut))}`}`
            : null;
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
                  <span className="font-medium">
                    {deuxChambres && `${fonction(chambreMandat, sexe)} · `}
                    {periodeLabel(m, chambreMandat)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {moisAnnee(m.dateDebut)} → {enCours ? 'en cours' : moisAnnee(m.dateFin!)}
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  {m.groupe && (
                    <Link
                      href={groupeHref!}
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

              <FonctionsMandat fonctions={fonctionsDe(i)} enCours={enCours} />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
