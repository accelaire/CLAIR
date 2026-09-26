import Link from 'next/link';
import { slugDepuisCode } from '@/lib/senatoriales/departements';
import type { ApercuSenatoriales } from '../PageClient';

type Circonscription = ApercuSenatoriales['circonscriptions'][number];

/**
 * Index des 64 circonscriptions.
 *
 * Il répond à un défaut précis : jusqu'ici, les pages départementales n'étaient
 * atteignables que par le titre d'une section de la liste des sortants, donc
 * seulement lorsque le tri par département était actif. Un lecteur arrivé avec
 * un autre tri, ou venu pour les candidats, n'avait aucun chemin vers sa propre
 * circonscription — alors que c'est la première chose qu'il cherche.
 *
 * Toujours rendu, quel que soit le tri, et en HTML servi : ces 64 liens sont
 * aussi le maillage interne qui fait exister les pages départementales pour un
 * moteur de recherche.
 */
export function IndexCirconscriptions({
  circonscriptions,
}: {
  circonscriptions: Circonscription[];
}) {
  if (circonscriptions.length === 0) return null;

  // Le libellé de l'étranger porte un rappel de série dont un index n'a que
  // faire : le titre de la page annonce déjà les sénatoriales 2026.
  const nettoyer = (nom: string) => nom.replace(/\s*\(Série \d+\)\s*$/, '').trim();

  const triees = [...circonscriptions].sort((a, b) =>
    nettoyer(a.nom).localeCompare(nettoyer(b.nom), 'fr'),
  );

  // `typeof === 'number'` et non `!== null` : le champ est à la fois optionnel
  // (une réponse mise en cache avant son ajout ne le porte pas) et nullable
  // (candidatures non publiées). Ne garder que `null` laissait passer
  // `undefined`, qui s'affichait en blanc devant un « cand. » orphelin.
  const avecCandidats = triees.some((circo) => typeof circo.nbCandidats === 'number');

  return (
    <section aria-labelledby="index-circonscriptions" className="space-y-3">
      <div>
        <h2 id="index-circonscriptions" className="text-lg font-semibold">
          Les {circonscriptions.length} circonscriptions concernées
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {avecCandidats
            ? 'Les candidats, le mode de scrutin et le bilan des sortants, circonscription par circonscription.'
            : 'Le mode de scrutin et le bilan des sortants, circonscription par circonscription.'}
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {triees.map((circo) => {
          const nom = nettoyer(circo.nom);
          return (
            <li key={circo.departement}>
              <Link
                href={`/senatoriales-2026/${slugDepuisCode(circo.departement)}`}
                className="flex items-baseline justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
              >
                <span className="min-w-0 leading-snug">{nom}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {typeof circo.nbCandidats === 'number' && <>{circo.nbCandidats} cand. · </>}
                  {circo.nbSieges} {circo.nbSieges > 1 ? 'sièges' : 'siège'}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
