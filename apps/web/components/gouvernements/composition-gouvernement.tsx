'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Portrait } from './portrait';
import {
  dateLongue,
  etapes as etapesDuGouvernement,
  libellePoste,
  lienFiche,
  nomComplet,
  parDomaine,
  type Domaine,
  type Etape,
  type GouvernementDetail,
  type PersonneGouvernement,
  type PosteMinisteriel,
} from '@/lib/gouvernements';

function Nom({ p, className = '' }: { p: PersonneGouvernement; className?: string }) {
  const fiche = lienFiche(p);
  return fiche ? (
    <Link href={fiche} className={`text-primary hover:underline ${className}`}>
      {nomComplet(p)}
    </Link>
  ) : (
    <span className={className}>{nomComplet(p)}</span>
  );
}

/** « 27 févr. 2026 » : la date d'une étape, assez courte pour la frise. */
function dateCourte(jour: string): string {
  return new Date(`${jour}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function Bilan({ e }: { e: Etape }) {
  if (e.nature === 'nomination') return <span className="text-muted-foreground">{e.composition.length} membres</span>;
  return (
    <span className="flex flex-wrap gap-x-1.5">
      {e.entrees.length > 0 && <span className="text-emerald-700 dark:text-emerald-400">+{e.entrees.length}</span>}
      {e.sorties.length > 0 && <span className="text-red-700 dark:text-red-400">−{e.sorties.length}</span>}
      {e.mutations.length > 0 && <span className="text-sky-700 dark:text-sky-400">↔{e.mutations.length}</span>}
    </span>
  );
}

/** Un remaniement nomme plusieurs personnes ; un départ ou un changement isolé n'en est pas un. */
function natureDe(e: Etape): string {
  if (e.nature === 'nomination') return 'Nomination';
  if (e.entrees.length + e.mutations.length >= 3) return 'Remaniement';
  if (e.entrees.length === 0 && e.mutations.length === 0) return e.sorties.length > 1 ? 'Départs' : 'Départ';
  return 'Changement';
}

const MARQUE = {
  entree: { texte: 'Entrée', classe: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  mutation: { texte: 'Nouveau poste', classe: 'bg-sky-500/10 text-sky-700 dark:text-sky-400' },
} as const;

function Poste({ p, marque }: { p: PosteMinisteriel; marque: keyof typeof MARQUE | null }) {
  const delegue = p.rangProtocolaire >= 40;
  return (
    <li className="flex items-center gap-3 py-2">
      <Portrait personne={p.membre} />
      <div className="min-w-0">
        <p className={`flex flex-wrap items-center gap-x-2 ${delegue ? 'text-sm' : 'font-medium'}`}>
          <Nom p={p.membre} />
          {marque && (
            <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${MARQUE[marque].classe}`}>{MARQUE[marque].texte}</span>
          )}
        </p>
        <p className="text-sm text-muted-foreground">{libellePoste(p.qualite, p.intituleCourt, p.intitule)}</p>
      </div>
    </li>
  );
}

/**
 * La composition d'un gouvernement, étape par étape : la nomination puis
 * chaque remaniement ou départ, dans une frise. Choisir une étape montre la
 * composition qui en résulte, ce qui a changé ce jour-là y étant marqué, et
 * les sortants à part. Le rendu serveur montre la dernière étape : la
 * composition actuelle, ou finale.
 */
export function CompositionGouvernement({
  gouvernement,
  domaines,
}: {
  gouvernement: Pick<GouvernementDetail, 'dateDebut' | 'dateFin' | 'enCours' | 'postes'>;
  domaines: Domaine[];
}) {
  // Calculées ici plutôt que reçues du serveur : chaque poste figurerait sinon
  // dans la page autant de fois qu'il y a d'étapes (13 pour Fillon II).
  const etapes = etapesDuGouvernement(gouvernement, gouvernement.postes);
  const enCours = gouvernement.enCours;
  const derniere = etapes.length - 1;
  const [choix, setChoix] = useState(derniere);
  const e = etapes[choix]!;
  // La frise s'ouvre sur la dernière étape : sur un gouvernement à treize
  // étapes, elle serait hors champ, à droite.
  const frise = useRef<HTMLDivElement>(null);
  const selection = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const conteneur = frise.current;
    const bouton = selection.current;
    if (!conteneur || !bouton) return;
    conteneur.scrollLeft = bouton.offsetLeft - conteneur.clientWidth / 2 + bouton.clientWidth / 2;
  }, [choix]);
  const changement = e.nature === 'changement';
  const marques = new Map<string, keyof typeof MARQUE>([
    ...(changement ? e.entrees.map((p) => [p.uid, 'entree'] as const) : []),
    ...e.mutations.map((p) => [p.uid, 'mutation'] as const),
  ]);
  // Le Premier ministre est présenté en tête de page.
  const groupes = parDomaine(
    e.composition.filter((p) => p.rangProtocolaire !== 1),
    domaines,
  );

  const titre =
    choix === derniere
      ? enCours
        ? 'Composition actuelle'
        : 'Composition finale'
      : e.nature === 'nomination'
        ? 'Composition à la nomination'
        : `Composition au ${dateLongue(e.date)}`;

  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold">Composition et remaniements</h2>
      {etapes.length > 1 && (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            Choisissez une étape pour voir la composition qui en résulte.{' '}
            <span className="text-emerald-700 dark:text-emerald-400">+ entrées</span>,{' '}
            <span className="text-red-700 dark:text-red-400">− départs</span>,{' '}
            <span className="text-sky-700 dark:text-sky-400">↔ changements de poste</span>.
          </p>
          <div ref={frise} className="relative -mx-4 overflow-x-auto px-4 pb-2">
            <ol className="flex min-w-max gap-2" aria-label="Étapes du gouvernement">
              {etapes.map((x, i) => (
                <li key={x.date}>
                  <button
                    type="button"
                    ref={i === choix ? selection : undefined}
                    onClick={() => setChoix(i)}
                    aria-pressed={i === choix}
                    className={`flex w-32 flex-col items-start rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      i === choix ? 'border-primary/50 bg-primary/5' : 'bg-card hover:bg-muted/50'
                    }`}
                  >
                    <span className="text-xs text-muted-foreground">
                      {natureDe(x)}
                    </span>
                    <span className="font-medium">{dateCourte(x.date)}</span>
                    <span className="text-xs font-medium">
                      <Bilan e={x} />
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}

      <div className="mt-4">
        <h3 className="font-semibold">{titre}</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          {e.composition.length} membres au {dateLongue(e.date)}, rangés par domaine ; dans chaque domaine, les ministres
          d&apos;abord.
        </p>

        {changement && e.sorties.length > 0 && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3">
            <p className="text-sm font-semibold">Quittent le gouvernement</p>
            <ul className="mt-1 space-y-1">
              {e.sorties.map((p) => (
                <li key={p.uid} className="text-sm">
                  <Nom p={p.membre} className="font-medium" />{' '}
                  <span className="text-muted-foreground">{libellePoste(p.qualite, p.intituleCourt, p.intitule)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* En colonnes plutôt qu'en grille : les domaines n'ont pas le même
            nombre de postes, et une grille laissait des trous sous les plus courts. */}
        <div className="gap-4 md:columns-2">
          {groupes.map(({ domaine, postes }) => (
            <section key={domaine.cle} className="mb-4 break-inside-avoid rounded-lg border bg-card px-4 py-3">
              <h4 className="border-b pb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{domaine.libelle}</h4>
              <ul className="divide-y">
                {postes.map((p) => (
                  <Poste key={p.uid} p={p} marque={marques.get(p.uid) ?? null} />
                ))}
              </ul>
            </section>
          ))}
        </div>
        {choix !== derniere && (
          <button type="button" onClick={() => setChoix(derniere)} className="text-sm text-primary hover:underline">
            Revenir à la composition {enCours ? 'actuelle' : 'finale'}
          </button>
        )}
      </div>
    </section>
  );
}
